// convex/auth.ts
import {query, action, mutation} from './_generated/server';
import {convexAuth} from '@convex-dev/auth/server';
import {Password} from '@convex-dev/auth/providers/Password';
import {v} from 'convex/values';
import {createAccount} from '@convex-dev/auth/server';
import {api} from './_generated/api';
import {Doc, Id} from './_generated/dataModel'; // Added Doc and Id imports
import bcrypt from 'bcryptjs'; // Import bcryptjs

// Export these — Convex looks for them.
export const {auth, signIn, signOut, isAuthenticated} = convexAuth({
	providers: [Password()],
});

/**
 * Mutation: store
 * This function is expected by the @convex-dev/auth library to persist session data.
 */
export const store = mutation({
	args: {
		args: v.union(
			v.object({
				refreshToken: v.string(),
				type: v.literal('refreshSession'),
			}),
			v.object({
				account: v.object({
					id: v.string(),
					secret: v.string(),
				}),
				provider: v.string(),
				type: v.literal('retrieveAccountWithCredentials'),
			}),
			v.object({
				// Added new type for createAccountFromCredentials
				account: v.object({
					id: v.string(),
					secret: v.string(),
				}),
				profile: v.object({
					email: v.string(),
					name: v.string(),
				}),
				provider: v.string(),
				type: v.literal('createAccountFromCredentials'),
			})
		),
	},
	returns: v.null(),
	handler: async (ctx, outerArgs) => {
		const args = outerArgs.args;

		if (args.type === 'refreshSession') {
			console.log(
				'Storing refresh token:',
				args.refreshToken,
				'Type:',
				args.type
			);
		} else if (args.type === 'retrieveAccountWithCredentials') {
			console.log(
				'Retrieving account with credentials:',
				args.account.id,
				'Provider:',
				args.provider,
				'Type:',
				args.type
			);
		} else if (args.type === 'createAccountFromCredentials') {
			// Added handler for new type
			console.log(
				'Creating account from credentials:',
				args.account.id,
				'Profile:',
				args.profile,
				'Provider:',
				args.provider,
				'Type:',
				args.type
			);
		} else {
			console.log('Unhandled store mutation type:', (args as any).type, args);
		}
		return null;
	},
});

/**
 * Query: needsBootstrap
 * Checks if an admin user needs to be bootstrapped (i.e., if no admins exist).
 */
export const needsBootstrap = query({
	args: {},
	returns: v.boolean(),
	handler: async (ctx) => {
		const existingAdmins = await ctx.db
			.query('roles')
			.filter((q) => q.eq(q.field('role'), 'admin'))
			.collect();
		return existingAdmins.length === 0;
	},
});

/**
 * Query: listAdmins
 */
export const listAdmins = query(async (ctx) => {
	return await ctx.db
		.query('roles')
		.filter((q) => q.eq(q.field('role'), 'admin'))
		.collect();
});

/**
 * Query: loggedInUser
 * Returns the current user with their role information
 */
export const loggedInUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;

		// Get user from users table
		const user: Doc<'users'> | null = await ctx.db.get(
			// Explicitly type user
			identity.subject as Id<'users'> // Cast identity.subject to Id<'users'>
		);
		if (!user) return null;

		// Get the user's role
		const roleRecord = await ctx.db
			.query('roles')
			.withIndex('by_userId', (q) => q.eq('userId', user._id))
			.first();

		return {
			_id: user._id,
			name: user.name,
			email: user.email,
			role: roleRecord?.role || null,
			locations: roleRecord?.locations || [],
		};
	},
});

/**
 * Helper mutation to write to your domain DB (actions can't write directly).
 */
export const _insertAdminRole = mutation({
	args: {
		userId: v.id('users'),
	},
	handler: async (ctx, {userId}) => {
		await ctx.db.insert('roles', {
			userId,
			role: 'admin',
			locations: [],
			assignedAt: Date.now(),
		});
		return true;
	},
});

/**
 * ACTION: bootstrapFirstAdmin
 * Runs createAccount (requires action ctx), then calls a mutation to insert the admin role.
 */
export const bootstrapFirstAdmin = action({
	args: {
		name: v.string(),
		email: v.string(),
		password: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.trim().toLowerCase();

		// 1) Allow creating multiple admins for now, as requested by the user.
		//    The original check was:
		//    const existing = await ctx.runQuery(api.auth.listAdmins);
		//    if (existing.length > 0) {
		//      return { ok: false, message: "Admin already exists" };
		//    }

		try {
			// 2) Create the user + password account
			const result = await createAccount(ctx, {
				provider: 'password',
				account: {
					id: email,
					secret: args.password,
				},
				profile: {
					email,
					name: args.name,
				},
			});

			if (!result || !result.user) {
				console.error('createAccount returned null or missing user:', result);
				return {
					ok: false,
					message: 'Failed to create user account (user object missing).',
				};
			}
			const {user} = result;

			// 3) Insert admin role via mutation
			await ctx.runMutation(api.auth._insertAdminRole, {userId: user._id});

			return {ok: true, userId: user._id};
		} catch (error: any) {
			console.error('Error creating admin account:', error);
			return {ok: false, message: error.message || 'Failed to create account'};
		}
	},
});

/**
 * ACTION: updateUserPasswordByEmail
 * Allows updating a user's password by email (must be action because bcrypt uses setTimeout)
 */
export const updateUserPasswordByEmail = action({
  args: {
	email: v.string(),
	newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string }> => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Find the user (actions can query)
	const user: Doc<'users'> | null = await ctx.runQuery(api.auth._findUserByEmail, { email: normalizedEmail });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Hash the new password (can use bcrypt in action)
    const hashedPassword = await bcrypt.hash(args.newPassword, 10);

    // Update via mutation
    const result = await ctx.runMutation(api.auth._updatePasswordHash, {
      userId: user._id,
      hashedPassword,
    });

    return result;
  },
});

/**
 * INTERNAL QUERY: _findUserByEmail
 */
export const _findUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    
    return user;
  },
});

/**
 * INTERNAL MUTATION: _updatePasswordHash
 */
export const _updatePasswordHash = mutation({
  args: {
    userId: v.id("users"),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Find and update the auth account
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("provider"), "password")
        )
      )
      .first();

    if (!authAccount) {
      return { success: false, message: "No password account found for user" };
    }

    // Update the password
    await ctx.db.patch(authAccount._id, {
      secret: args.hashedPassword,
    });

    console.log(`Password updated successfully for user ${args.userId}`);
    return { success: true };
  },
});