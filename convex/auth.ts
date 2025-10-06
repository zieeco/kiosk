// convex/auth.ts
import { query, action, mutation } from "./_generated/server";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// Export these — Convex looks for them.
export const { auth, signIn, signOut, isAuthenticated } = convexAuth({
  providers: [Password()],
});

/**
 * Query: listAdmins — kept in this module so it's available as api.auth.listAdmins
 */
export const listAdmins = query(async (ctx) => {
  return await ctx.db
    .query("roles") // adjust table name if yours is different
    .filter((q) => q.eq(q.field("role"), "admin"))
    .collect();
});

/**
 * Helper mutation to write to your domain DB (actions can't write directly).
 * We'll call this from the action after creating the account.
 */
export const _insertAdminRole = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    await ctx.db.insert("roles", {
      userId,
      role: "admin",
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

    // 1) Prevent double-bootstrapping: check if an admin exists
    const existing = await ctx.runQuery(api.auth.listAdmins);
    if (existing.length > 0) {
      return { ok: false, message: "Admin already exists" };
    }

    // 2) Create the user + password account (DO NOT hash yourself)
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: {
        id: email,             // identifier (email)
        secret: args.password, // RAW password; library handles hashing/secret
      },
      profile: {
        email,
        name: args.name,
      },
    });

    // 3) Insert admin role via mutation
    await ctx.runMutation(api.auth._insertAdminRole, { userId: user._id });

    return { ok: true, userId: user._id };
  },
});
