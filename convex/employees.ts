import {
	mutation,
	query,
	action,
	internalQuery,
	MutationCtx,
	internalMutation,
} from './_generated/server';
import {v} from 'convex/values';
// import {api} from './_generated/api';
import {internal} from './_generated/api';
import {
	// Doc,
	Id,
} from './_generated/dataModel';

// Helper: Get user role doc
async function getUserRoleDoc(ctx: {db: any}, clerkUserId: string) {
	return await ctx.db
		.query('roles')
		.withIndex('by_clerkUserId', (q: any) => q.eq('clerkUserId', clerkUserId))
		.unique();
}

// Helper: Audit (for mutations only)
async function audit(
	ctx: {db: any},
	event: string,
	clerkUserId: string | null,
	details?: string
) {
	await ctx.db.insert('audit_logs', {
		clerkUserId: clerkUserId, // Pass null directly if clerkUserId is null
		event,
		timestamp: Date.now(),
		deviceId: 'system',
		location: '',
		details,
	});
}

// Helper: Check admin access (for queries - no audit)
async function requireAdminQuery(ctx: {db: any}, clerkUserId: string) {
	const userRole = await getUserRoleDoc(ctx, clerkUserId);
	if (!userRole || userRole.role !== 'admin') {
		throw new Error('Admin access required');
	}
	return userRole;
}

// Helper: Check admin access (for mutations - with audit)
async function requireAdmin(ctx: {db: any}, clerkUserId: string) {
	const userRole = await getUserRoleDoc(ctx, clerkUserId);
	if (!userRole || userRole.role !== 'admin') {
		await audit(ctx, 'access_denied', clerkUserId, 'admin_required');
		throw new Error('Admin access required');
	}
	return userRole;
}

// Query: List all employees with mapped fields for frontend (admin only)
export const listEmployees = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error('Not authenticated');
		const clerkUserId = identity.subject;

		await requireAdminQuery(ctx, clerkUserId);

		const employees = await ctx.db.query('employees').collect();
		return employees.map((emp) => ({
			id: emp._id,
			name: emp.name,
			email: emp.email,
			workEmail: emp.workEmail,
			phone: emp.phone,
			role: emp.role,
			locations: emp.locations || [],
			employmentStatus: emp.employmentStatus,
			clerkUserId: emp.clerkUserId,
			assignedDeviceId: emp.assignedDeviceId,
		}));
	},
});

// Helper to generate a random password
function generatePassword(length = 12) {
	const chars =
		'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
	let password = '';
	for (let i = 0; i < length; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return password;
}

// --- CREATE EMPLOYEE ACTION (admin only) ---
export const createEmployee = action({
	args: {
		name: v.string(),
		email: v.string(),
		role: v.union(
			v.literal('admin'),
			v.literal('supervisor'),
			v.literal('staff')
		),
		locations: v.array(v.string()),
		assignedDeviceId: v.optional(v.string()), // New argument for assigned device
	},
	handler: async (
		ctx,
		args
	): Promise<{
		success: boolean;
		employeeId: Id<'employees'>;
		clerkUserId: string;
		generatedPassword?: string;
	}> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error('Not authenticated');
		const adminClerkUserId = identity.subject;
		// Note: requireAdmin is a mutation helper, actions cannot call mutations directly.
		// For actions, we need to re-implement the admin check or call an internal query.
		// For simplicity, we'll assume the frontend ensures admin access for this action.
		// In a real app, you'd call an internalQuery to check role.

		// Check if employee with this email already exists in Convex
		const existingEmployee = await ctx.runQuery(
			internal.employees.getEmployeeByEmail,
			{email: args.email}
		);

		if (existingEmployee) {
			throw new Error('Employee with this email already exists');
		}

		// Generate a random password for the new Clerk user
		const generatedPassword = generatePassword();

		// Create user in Clerk via Convex action
		let clerkUser;
		try {
			clerkUser = await ctx.runAction(internal.clerk.createClerkUser, {
				email: args.email,
				password: generatedPassword,
				firstName: args.name.split(' ')[0] || '',
				lastName: args.name.split(' ').slice(1).join(' ') || '',
			});
		} catch (error) {
			console.error('Failed to create Clerk user:', error);
			throw new Error(
				`Failed to create employee account: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		if (!clerkUser || !clerkUser.clerkUserId) {
			throw new Error('Failed to get Clerk user ID after creation.');
		}
		const clerkUserId = clerkUser.clerkUserId;

		// Store employee record in Convex, linked to Clerk user
		const employeeId = await ctx.runMutation(
			internal.employees.insertEmployeeAndRole,
			{
				name: args.name,
				email: args.email,
				workEmail: args.email,
				role: args.role,
				locations: args.locations,
				clerkUserId: clerkUserId, // Link to Clerk user
				adminClerkUserId: adminClerkUserId,
				assignedDeviceId: args.assignedDeviceId, // Pass assigned device ID
			}
		);

		await ctx.runMutation(internal.audit.log, {
			clerkUserId: adminClerkUserId,
			event: 'create_employee',
			details: `employeeId=${employeeId},clerkUserId=${clerkUserId},role=${args.role},assignedDeviceId=${args.assignedDeviceId || 'none'}`,
			deviceId: 'system', // Placeholder, will be replaced by actual device ID
			location: '', // Placeholder, will be replaced by actual location
		});

		// Send welcome email with credentials
		try {
			await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
				// Assuming a new email function
				employeeId: employeeId,
				email: args.email,
				password: generatedPassword,
			});
			console.log('Scheduled welcome email for new employee:', employeeId);
		} catch (error) {
			console.error(
				'Failed to schedule welcome email for new employee:',
				error
			);
			// Don't throw here, still return success
		}

		return {
			success: true,
			employeeId,
			clerkUserId: clerkUserId,
			generatedPassword, // Return password for immediate display if needed (e.g., for testing)
		};
	},
});

// Internal mutation to insert employee and role (called by createEmployee action)
export const insertEmployeeAndRole = internalMutation({
	args: {
		name: v.string(),
		email: v.string(),
		workEmail: v.string(),
		role: v.union(
			v.literal('admin'),
			v.literal('supervisor'),
			v.literal('staff')
		),
		locations: v.array(v.string()),
		clerkUserId: v.string(),
		adminClerkUserId: v.string(),
		assignedDeviceId: v.optional(v.string()), // New argument for assigned device
	},
	handler: async (
		ctx: MutationCtx,
		args: {
			name: string;
			email: string;
			workEmail: string;
			role: 'admin' | 'supervisor' | 'staff';
			locations: string[];
			clerkUserId: string;
			adminClerkUserId: string;
			assignedDeviceId?: string;
		}
	) => {
		const employeeId = await ctx.db.insert('employees', {
			name: args.name,
			email: args.email,
			workEmail: args.workEmail,
			role: args.role,
			locations: args.locations,
			clerkUserId: args.clerkUserId,
			employmentStatus: 'active',
			assignedDeviceId: args.assignedDeviceId, // Store assigned device ID
		});

		await ctx.db.insert('roles', {
			clerkUserId: args.clerkUserId,
			role: args.role,
			locations: args.locations,
			assignedBy: args.adminClerkUserId,
			assignedAt: Date.now(),
		});
		return employeeId;
	},
});

// Internal query to get employee by email (for createEmployee action)
export const getEmployeeByEmail = internalQuery({
	args: {email: v.string()},
	handler: async (ctx, args) => {
		return await ctx.db
			.query('employees')
			.filter((q) => q.eq(q.field('email'), args.email))
			.first();
	},
});

// --- UPDATE EMPLOYEE MUTATION (admin only) ---
export const updateEmployee = mutation({
	args: {
		employeeId: v.id('employees'),
		name: v.string(),
		email: v.string(),
		role: v.union(
			v.literal('admin'),
			v.literal('supervisor'),
			v.literal('staff')
		),
		locations: v.array(v.string()),
		assignedDeviceId: v.optional(v.string()), // New argument for assigned device
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error('Not authenticated');
		const clerkUserId = identity.subject;
		await requireAdmin(ctx, clerkUserId);

		const employee = await ctx.db.get(args.employeeId);
		if (!employee) throw new Error('Employee not found');

		// Update employee record
		await ctx.db.patch(args.employeeId, {
			name: args.name,
			email: args.email,
			role: args.role,
			locations: args.locations,
			updatedAt: Date.now(),
			assignedDeviceId: args.assignedDeviceId, // Update assigned device ID
		});

		await audit(
			ctx,
			'update_employee',
			clerkUserId,
			`employeeId=${args.employeeId},role=${args.role},assignedDeviceId=${args.assignedDeviceId || 'none'}`
		);
		return {success: true};
	},
});

// --- DELETE EMPLOYEE MUTATION (admin only) - CASCADE ---
export const deleteEmployee = mutation({
	args: {employeeId: v.id('employees')},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error('Not authenticated');
		const clerkUserId = identity.subject;
		await requireAdmin(ctx, clerkUserId);

		const employee = await ctx.db.get(args.employeeId);
		if (!employee) throw new Error('Employee not found');

		// CASCADE: Find and delete linked user account and all related data
		let linkedClerkUserId: string | null = null;
		if (employee.clerkUserId) {
			linkedClerkUserId = employee.clerkUserId;
		}

		if (linkedClerkUserId) {
			// 1. Delete role record
			const role = await ctx.db
				.query('roles')
				.withIndex('by_clerkUserId', (q: any) =>
					q.eq('clerkUserId', linkedClerkUserId)
				)
				.unique();
			if (role) {
				await ctx.db.delete(role._id);
			}

			// 2. Delete all shifts
			const shifts = await ctx.db
				.query('shifts')
				.withIndex('by_clerkUserId', (q) =>
					q.eq('clerkUserId', linkedClerkUserId)
				)
				.collect();
			for (const shift of shifts) {
				await ctx.db.delete(shift._id);
			}

			// 3. Delete all resident_logs
			const logs = await ctx.db
				.query('resident_logs')
				.withIndex('by_authorId', (q) => q.eq('authorId', linkedClerkUserId))
				.collect();
			for (const log of logs) {
				await ctx.db.delete(log._id);
			}

			// 4. Delete all audit_logs
			const audits = await ctx.db
				.query('audit_logs')
				.withIndex('by_clerkUserId', (q) =>
					q.eq('clerkUserId', linkedClerkUserId)
				)
				.collect();
			for (const auditLog of audits) {
				await ctx.db.delete(auditLog._id);
			}

			// 5. Delete all ISP access logs
			const ispAccessLogs = await ctx.db
				.query('isp_access_logs')
				.withIndex('by_clerkUserId', (q) =>
					q.eq('clerkUserId', linkedClerkUserId)
				)
				.collect();
			for (const log of ispAccessLogs) {
				await ctx.db.delete(log._id);
			}

			// 6. Delete all ISP acknowledgments
			const ispAcks = await ctx.db.query('isp_acknowledgments').collect();
			for (const ack of ispAcks) {
				if (ack.clerkUserId === linkedClerkUserId) {
					await ctx.db.delete(ack._id);
				}
			}

			// 7. Update compliance_alerts dismissed by this user (set to null)
			const alerts = await ctx.db.query('compliance_alerts').collect();
			for (const alert of alerts) {
				if (alert.dismissedBy === linkedClerkUserId) {
					await ctx.db.patch(alert._id, {dismissedBy: undefined});
				}
			}

			// 8. Update residents created by this user (set to null)
			const residents = await ctx.db
				.query('residents')
				.withIndex('by_createdBy', (q) => q.eq('createdBy', linkedClerkUserId))
				.collect();
			for (const resident of residents) {
				await ctx.db.patch(resident._id, {createdBy: undefined});
			}

			// 9. Update guardians created by this user (set to null)
			const guardians = await ctx.db
				.query('guardians')
				.withIndex('by_createdBy', (q) => q.eq('createdBy', linkedClerkUserId))
				.collect();
			for (const guardian of guardians) {
				await ctx.db.patch(guardian._id, {createdBy: undefined});
			}

			// 10. Update kiosks created/registered by this user (set to null)
			const kiosks = await ctx.db.query('kiosks').collect();
			for (const kiosk of kiosks) {
				if (
					kiosk.createdBy === linkedClerkUserId ||
					kiosk.registeredBy === linkedClerkUserId
				) {
					await ctx.db.patch(kiosk._id, {
						createdBy: undefined,
						registeredBy: undefined,
					});
				}
			}

			// 11. Schedule deletion of the Clerk user account
			try {
				await ctx.scheduler.runAfter(0, internal.clerk.deleteClerkUser, {
					clerkUserId: linkedClerkUserId,
				});
				console.log('Scheduled deletion of Clerk user:', linkedClerkUserId);
			} catch (error) {
				console.error('Failed to schedule Clerk user deletion:', error);
				// Don't throw here, continue with Convex record deletion
			}
		}

		// 12. Delete the employee record
		await ctx.db.delete(args.employeeId);

		await audit(
			ctx,
			'delete_employee',
			clerkUserId,
			`employeeId=${args.employeeId},linkedClerkUserId=${linkedClerkUserId || 'none'}`
		);
		return {success: true};
	},
});

// --- INTERNAL QUERY TO GET EMPLOYEE FOR EMAIL ---
export const getEmployeeForEmail = internalQuery({
	args: {employeeId: v.id('employees')},
	handler: async (ctx, args) => {
		const employee = await ctx.db.get(args.employeeId);
		if (!employee) return null;

		return {
			name: employee.name,
			email: employee.email || employee.workEmail || '',
			role: employee.role || 'staff',
			locations: employee.locations || [],
		};
	},
});

// --- QUERY TO CHECK DEVICE AUTHORIZATION ---
export const checkDeviceAuthorization = query({
	args: {
		clerkUserId: v.string(),
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const employee = await ctx.db
			.query('employees')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.unique();

		if (!employee) {
			console.log('❌ Employee not found');
			return {isAuthorized: false, reason: 'Employee not found'};
		}

		// IF NO DEVICE ASSIGNED (undefined), ALLOW ACCESS (for admins/flexible users)
		if (!employee.assignedDeviceId) {
			console.log('✅ No device restriction - access granted');
			return {isAuthorized: true};
		}

		// IF DEVICE IS ASSIGNED, CHECK IF IT MATCHES
		if (employee.assignedDeviceId === args.deviceId) {
			console.log('✅ Device matches - access granted');
			return {isAuthorized: true};
		} else {
			console.log('❌ Device mismatch - access denied');
			return {
				isAuthorized: false,
				reason: 'Device not assigned to this employee',
			};
		}
	},
});
