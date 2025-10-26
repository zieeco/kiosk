import {query, mutation} from './_generated/server';

/**
 * Self-Healing Authentication Query
 * Called on every login to ensure user exists in Convex
 * If user doesn't exist, auto-creates from Clerk data
 */
export const ensureUserExists = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		const clerkUserId = identity.subject;
		const email = identity.email || '';
		const name = identity.name || email.split('@')[0] || 'User';

		console.log('🔍 Checking if user exists:', clerkUserId, email);

		// Check if user exists in users table
		const user = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.first();

		if (!user) {
			console.log(
				'⚠️  User not found in database - will auto-create on next mutation'
			);
			return {
				exists: false,
				clerkUserId,
				email,
				name,
				needsSync: true,
			};
		}

		// Check if employee record exists
		const employee = await ctx.db
			.query('employees')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.first();

		if (!employee) {
			console.log('⚠️  Employee record missing - will auto-create');
			return {
				exists: false,
				clerkUserId,
				email,
				name,
				needsSync: true,
			};
		}

		// Check if role exists
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.first();

		console.log('✅ User exists with role:', role?.role || 'pending');

		return {
			exists: true,
			clerkUserId,
			email,
			name,
			role: role?.role || null,
			locations: role?.locations || employee.locations || [],
			employmentStatus: employee.employmentStatus,
			needsSync: false,
		};
	},
});

/**
 * Mutation: Auto-create missing user records
 * Called when user logs in but doesn't exist in database
 */
export const autoSyncUser = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) throw new Error('Not authenticated');

		const clerkUserId = identity.subject;
		const email = identity.email || '';
		const name = identity.name || email.split('@')[0] || 'User';

		console.log('🔄 Auto-syncing user:', clerkUserId, email);

		// Create user record if missing
		const existingUser = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.first();

		if (!existingUser) {
			await ctx.db.insert('users', {
				clerkUserId,
				email,
				name,
				createdAt: Date.now(),
			});
			console.log('✅ User record created');
		}

		// Create employee record if missing
		const existingEmployee = await ctx.db
			.query('employees')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', clerkUserId))
			.first();

		if (!existingEmployee) {
			// Check if this should be an admin (first user)
			const existingAdmins = await ctx.db
				.query('roles')
				.filter((q) => q.eq(q.field('role'), 'admin'))
				.collect();

			const isFirstUser = existingAdmins.length === 0;

			await ctx.db.insert('employees', {
				name,
				workEmail: email,
				email,
				clerkUserId,
				role: isFirstUser ? 'admin' : 'staff',
				locations: [],
				employmentStatus: isFirstUser ? 'active' : 'pending',
				createdAt: Date.now(),
			});

			console.log(
				`✅ Employee record created (${isFirstUser ? 'admin' : 'pending'})`
			);

			// Create role if first user
			if (isFirstUser) {
				await ctx.db.insert('roles', {
					clerkUserId,
					role: 'admin',
					locations: [],
					assignedAt: Date.now(),
				});
				console.log('✅ First admin role created automatically');
			}
		}

		console.log('✅ User sync complete');

		return {success: true, isFirstAdmin: existingEmployee === null};
	},
});
