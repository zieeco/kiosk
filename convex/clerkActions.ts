'use node';
import {internalAction} from './_generated/server';
import {v} from 'convex/values';
import {createClerkClient} from '@clerk/backend';
import {Webhook} from 'svix';
import {internal} from './_generated/api';

const clerk = createClerkClient({
	secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * HTTP endpoint to receive Clerk webhooks
 */
export const handleClerkWebhook = internalAction({
	args: {
		payload: v.string(),
		headers: v.object({
			svix_id: v.string(),
			svix_timestamp: v.string(),
			svix_signature: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new Error('CLERK_WEBHOOK_SECRET is not set');
		}

		console.log('📨 Received Clerk webhook');

		const wh = new Webhook(webhookSecret);
		let event: any;
		try {
			event = wh.verify(args.payload, args.headers);
			console.log('✅ Webhook verified:', event.type);
		} catch (err) {
			console.error('❌ Webhook verification failed:', err);
			throw new Error('Invalid webhook signature');
		}

		const eventType = event.type;
		const userData = event.data;

		switch (eventType) {
			case 'user.created':
				console.log('👤 User created:', userData.id);
				await ctx.runMutation(internal.clerk.syncUserFromClerk, {
					clerkUserId: userData.id,
					email: userData.email_addresses?.[0]?.email_address || '',
					name:
						`${userData.first_name || ''} ${userData.last_name || ''}`.trim() ||
						'User',
					createdAt: userData.created_at,
				});
				break;

			case 'user.updated':
				console.log('🔄 User updated:', userData.id);
				await ctx.runMutation(internal.clerk.updateUserFromClerk, {
					clerkUserId: userData.id,
					email: userData.email_addresses?.[0]?.email_address || '',
					name:
						`${userData.first_name || ''} ${userData.last_name || ''}`.trim() ||
						'User',
				});
				break;

			case 'user.deleted':
				console.log('🗑️  User deleted:', userData.id);
				await ctx.runMutation(internal.clerk.deleteUserFromClerk, {
					clerkUserId: userData.id,
				});
				break;

			default:
				console.log('ℹ️  Unhandled Clerk webhook event:', eventType);
				break;
		}

		return {success: true};
	},
});

/**
 * Create a Clerk user programmatically
 * Updated to handle username requirement
 */
export const createClerkUser = internalAction({
	args: {
		email: v.string(),
		password: v.string(),
		firstName: v.string(),
		lastName: v.string(),
	},
	handler: async (ctx, args) => {
		try {
			console.log('🔐 Creating Clerk user:', args.email);

			// Generate username from email (before @ symbol)
			const username = args.email.split('@')[0].toLowerCase();

			const user = await clerk.users.createUser({
				emailAddress: [args.email],
				password: args.password,
				firstName: args.firstName,
				lastName: args.lastName,
				username: username, // ✅ ADD USERNAME
				skipPasswordChecks: false,
				skipPasswordRequirement: false,
			});

			console.log('✅ Clerk user created:', user.id);

			return {
				clerkUserId: user.id,
				email: user.emailAddresses[0].emailAddress,
			};
		} catch (error: any) {
			console.error('❌ Error creating Clerk user:', error);

			// Better error handling
			if (error.errors) {
				const errorMessages = error.errors
					.map((e: any) => e.longMessage || e.message)
					.join(', ');
				throw new Error(`Failed to create Clerk user: ${errorMessages}`);
			}

			throw new Error(
				`Failed to create Clerk user: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
});

/**
 * Delete a Clerk user
 */
export const deleteClerkUser = internalAction({
	args: {
		clerkUserId: v.string(),
	},
	handler: async (ctx, args) => {
		try {
			console.log('🗑️  Deleting Clerk user:', args.clerkUserId);
			await clerk.users.deleteUser(args.clerkUserId);
			console.log('✅ Clerk user deleted');
			return {success: true};
		} catch (error) {
			console.error('❌ Error deleting Clerk user:', error);
			throw new Error(
				`Failed to delete Clerk user: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
});

/**
 * Get Clerk user by ID
 */
export const getClerkUserById = internalAction({
	args: {
		id: v.string(),
	},
	handler: async (ctx, args) => {
		try {
			return await clerk.users.getUser(args.id);
		} catch (error) {
			console.error('❌ Error getting Clerk user:', error);
			throw new Error(
				`Failed to get Clerk user: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
});
