import {v} from 'convex/values';
import {mutation, query} from './_generated/server';
import {getAuthUserId} from '@convex-dev/auth/server';

// Generate a simple token for device registration
function generateDeviceToken(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let token = '';
	for (let i = 0; i < 8; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

// MUTATION: Register a new device
export const registerDevice = mutation({
	args: {
		deviceId: v.string(), // Browser fingerprint
		deviceName: v.string(),
		location: v.string(),
		deviceType: v.optional(
			v.union(v.literal('kiosk'), v.literal('mobile'), v.literal('desktop'))
		),
		metadata: v.optional(
			v.object({
				browser: v.optional(v.string()),
				os: v.optional(v.string()),
				screenResolution: v.optional(v.string()),
				ipAddress: v.optional(v.string()),
			})
		),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Check if user is admin
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (role?.role !== 'admin') {
			throw new Error('Only admins can register devices');
		}

		// Check if device already exists
		const existingDevice = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (existingDevice) {
			throw new Error('Device already registered');
		}

		// Create the device
		const deviceId = await ctx.db.insert('devices', {
			deviceId: args.deviceId,
			deviceName: args.deviceName,
			location: args.location,
			isActive: true,
			deviceType: args.deviceType || 'desktop',
			registeredBy: userId,
			registeredAt: Date.now(),
			metadata: args.metadata,
			notes: args.notes,
		});

		// Log the registration
		await ctx.db.insert('audit_logs', {
			clerkUserId: userId,
			event: 'device_registered',
			timestamp: Date.now(),
			deviceId: args.deviceId,
			location: args.location,
			details: `Registered device: ${args.deviceName}`,
		});

		return {success: true, deviceId};
	},
});

// QUERY: Check if a device is registered and active
export const checkDevice = query({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (!device) {
			return {
				isRegistered: false,
				isActive: false,
				message: 'Device not registered',
			};
		}

		return {
			isRegistered: true,
			isActive: device.isActive,
			deviceName: device.deviceName,
			location: device.location,
			deviceType: device.deviceType,
			message: device.isActive
				? 'Device is active'
				: 'Device is inactive. Contact administrator.',
		};
	},
});

// QUERY: Get all registered devices (admin only)
export const listDevices = query({
	args: {
		location: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Check if user is admin
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (role?.role !== 'admin') {
			throw new Error('Only admins can view devices');
		}

		// Get devices
		let devicesQuery = ctx.db.query('devices');

		if (args.location) {
			devicesQuery = devicesQuery.withIndex('by_location', (q) =>
				q.eq('location', args.location)
			);
		}

		const devices = await devicesQuery.collect();

		// Sort by registration date (newest first)
		return devices.sort((a, b) => b.registeredAt - a.registeredAt);
	},
});

// MUTATION: Update device status (activate/deactivate)
export const updateDeviceStatus = mutation({
	args: {
		deviceId: v.string(),
		isActive: v.boolean(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Check if user is admin
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (role?.role !== 'admin') {
			throw new Error('Only admins can update devices');
		}

		// Find the device
		const device = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (!device) {
			throw new Error('Device not found');
		}

		// Update the device
		await ctx.db.patch(device._id, {
			isActive: args.isActive,
		});

		// Log the change
		await ctx.db.insert('audit_logs', {
			clerkUserId: userId,
			event: args.isActive ? 'device_activated' : 'device_deactivated',
			timestamp: Date.now(),
			deviceId: args.deviceId,
			location: device.location,
			details: `${args.isActive ? 'Activated' : 'Deactivated'} device: ${device.deviceName}`,
		});

		return {success: true};
	},
});

// MUTATION: Delete a device
export const deleteDevice = mutation({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Check if user is admin
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (role?.role !== 'admin') {
			throw new Error('Only admins can delete devices');
		}

		// Find the device
		const device = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (!device) {
			throw new Error('Device not found');
		}

		// Delete the device
		await ctx.db.delete(device._id);

		// Log the deletion
		await ctx.db.insert('audit_logs', {
			clerkUserId: userId,
			event: 'device_deleted',
			timestamp: Date.now(),
			deviceId: args.deviceId,
			location: device.location,
			details: `Deleted device: ${device.deviceName}`,
		});

		return {success: true};
	},
});

// MUTATION: Update device info
export const updateDevice = mutation({
	args: {
		deviceId: v.string(),
		deviceName: v.optional(v.string()),
		location: v.optional(v.string()),
		notes: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Check if user is admin
		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (role?.role !== 'admin') {
			throw new Error('Only admins can update devices');
		}

		// Find the device
		const device = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (!device) {
			throw new Error('Device not found');
		}

		// Prepare update object
		const updates: any = {};
		if (args.deviceName !== undefined) updates.deviceName = args.deviceName;
		if (args.location !== undefined) updates.location = args.location;
		if (args.notes !== undefined) updates.notes = args.notes;

		// Update the device
		await ctx.db.patch(device._id, updates);

		// Log the update
		await ctx.db.insert('audit_logs', {
			clerkUserId: userId,
			event: 'device_updated',
			timestamp: Date.now(),
			deviceId: args.deviceId,
			location: device.location,
			details: `Updated device: ${device.deviceName}`,
		});

		return {success: true};
	},
});

// MUTATION: Record device usage (called when someone logs in)
export const recordDeviceUsage = mutation({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error('Not authenticated');
		}

		// Find the device
		const device = await ctx.db
			.query('devices')
			.withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
			.first();

		if (!device) {
			return {success: false, message: 'Device not registered'};
		}

		if (!device.isActive) {
			return {success: false, message: 'Device is inactive'};
		}

		// Update device last used info
		await ctx.db.patch(device._id, {
			lastUsedAt: Date.now(),
			lastUsedBy: userId,
		});

		// Update or create user record
		const user = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
			.first();

		if (user) {
			await ctx.db.patch(user._id, {
				lastLoginAt: Date.now(),
				lastLoginDeviceId: args.deviceId,
				lastLoginLocation: device.location,
				updatedAt: Date.now(),
			});
		} else {
			// Get user info from roles or employees table
			const role = await ctx.db
				.query('roles')
				.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
				.first();

			const employee = await ctx.db
				.query('employees')
				.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', userId))
				.first();

			await ctx.db.insert('users', {
				clerkUserId: userId,
				email: employee?.workEmail || employee?.email || 'unknown@example.com',
				name: employee?.name || 'Unknown User',
				lastLoginAt: Date.now(),
				lastLoginDeviceId: args.deviceId,
				lastLoginLocation: device.location,
				createdAt: Date.now(),
			});
		}

		return {
			success: true,
			deviceName: device.deviceName,
			location: device.location,
		};
	},
});
