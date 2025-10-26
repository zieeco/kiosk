// NO 'use node' here!
import {internalMutation} from './_generated/server';
import {v} from 'convex/values';

/**
 * Internal mutation: Sync user from Clerk to Convex
 */
export const syncUserFromClerk = internalMutation({
	args: {
		clerkUserId: v.string(),
		email: v.string(),
		name: v.string(),
		createdAt: v.number(),
	},
	handler: async (ctx, args) => {
		console.log('🔄 Syncing user to Convex:', args.clerkUserId, args.email);

		// Check if user already exists
		const existingUser = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (existingUser) {
			console.log('ℹ️  User already exists, skipping sync');
			return {alreadyExists: true};
		}

		// Create user record
		await ctx.db.insert('users', {
			clerkUserId: args.clerkUserId,
			email: args.email,
			name: args.name,
			createdAt: args.createdAt,
		});

		console.log('✅ User record created');

		// Check if this is the first user (should become admin)
		const existingAdmins = await ctx.db
			.query('roles')
			.filter((q) => q.eq(q.field('role'), 'admin'))
			.collect();

		const isFirstUser = existingAdmins.length === 0;

		if (isFirstUser) {
			console.log('🎖️  First user detected - creating admin account');

			await ctx.db.insert('employees', {
				name: args.name,
				workEmail: args.email,
				email: args.email,
				clerkUserId: args.clerkUserId,
				role: 'admin',
				locations: [],
				employmentStatus: 'active',
				createdAt: Date.now(),
				onboardedAt: Date.now(),
			});

			await ctx.db.insert('roles', {
				clerkUserId: args.clerkUserId,
				role: 'admin',
				locations: [],
				assignedAt: Date.now(),
			});

			console.log('✅ First admin created automatically!');
			return {isFirstAdmin: true};
		} else {
			console.log('👤 Creating pending employee record');

			await ctx.db.insert('employees', {
				name: args.name,
				workEmail: args.email,
				email: args.email,
				clerkUserId: args.clerkUserId,
				role: 'staff',
				locations: [],
				employmentStatus: 'pending',
				createdAt: Date.now(),
			});

			console.log('✅ Pending employee created - awaiting admin assignment');
			return {isPending: true};
		}
	},
});

/**
 * Internal mutation: Update user from Clerk
 */
export const updateUserFromClerk = internalMutation({
	args: {
		clerkUserId: v.string(),
		email: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		console.log('🔄 Updating user:', args.clerkUserId);

		const user = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (user) {
			await ctx.db.patch(user._id, {
				email: args.email,
				name: args.name,
				updatedAt: Date.now(),
			});
		}

		const employee = await ctx.db
			.query('employees')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (employee) {
			await ctx.db.patch(employee._id, {
				name: args.name,
				email: args.email,
				workEmail: args.email,
				updatedAt: Date.now(),
			});
		}

		console.log('✅ User updated');
		return {success: true};
	},
});

/**
 * Internal mutation: Delete user from Clerk
 */
export const deleteUserFromClerk = internalMutation({
	args: {
		clerkUserId: v.string(),
	},
	handler: async (ctx, args) => {
		console.log('🗑️  Deleting user from Convex:', args.clerkUserId);

		const user = await ctx.db
			.query('users')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (user) {
			await ctx.db.delete(user._id);
			console.log('✅ User record deleted');
		}

		const employee = await ctx.db
			.query('employees')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (employee) {
			await ctx.db.delete(employee._id);
			console.log('✅ Employee record deleted');
		}

		const role = await ctx.db
			.query('roles')
			.withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
			.first();

		if (role) {
			await ctx.db.delete(role._id);
			console.log('✅ Role record deleted');
		}

		return {success: true};
	},
});
