// convex/employees.ts
import { action, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { createAccount } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/**
 * INTERNAL QUERY expected by emails.ts / emailsSMTP.ts:
 * Accepts either { employeeId } OR { email } (or both).
 * We normalize the returned object so role/locations are always defined.
 */
export const getEmployeeForEmail = internalQuery({
  args: {
    // callers sometimes pass only employeeId; email is optional
    email: v.optional(v.string()),
    employeeId: v.optional(v.id("employees")),
  },
  handler: async (ctx, { email, employeeId }) => {
    let emp: any | null = null;

    // 1) Prefer an explicit employeeId if provided
    if (employeeId) {
      emp = await ctx.db.get(employeeId);
    }

    // 2) If no id or not found, try by email (workEmail then email)
    if (!emp && email) {
      const e = email.trim().toLowerCase();

      emp = await ctx.db
        .query("employees")
        .filter((q) => q.eq(q.field("workEmail"), e))
        .first();

      if (!emp) {
        emp = await ctx.db
          .query("employees")
          .filter((q) => q.eq(q.field("email"), e))
          .first();
      }
    }

    if (!emp) return null;

    // Normalize fields so TS sees them as defined in emails.ts
    const normalized = {
      ...emp,
      name: emp.name ?? emp.fullName ?? "",
      role: (emp.role ?? "") as "" | "admin" | "supervisor" | "staff",
      locations: (emp.locations ?? []) as string[],
    };

    return normalized;
  },
});

/**
 * Helper mutation: insert app-side employee + role records.
 * Your employees table requires `name` and `workEmail`; it does NOT have `userId`.
 */
export const _insertEmployeeAndRole = mutation({
  args: {
    userId: v.id("users"), // used for roles table
    fullName: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
  },
  handler: async (ctx, { userId, fullName, email, role }) => {
    const e = email.trim().toLowerCase();

    await ctx.db.insert("employees", {
      name: fullName,     // required by your schema
      workEmail: e,       // required by your schema
      email: e,           // optional, if present in your schema
      role,               // keep in employees for email templates
      locations: [],      // ensure defined
      createdAt: Date.now(),
    });

    await ctx.db.insert("roles", {
      userId,
      role,
      locations: [],
      assignedAt: Date.now(),
    });

    return true;
  },
});

/**
 * ACTION: createEmployeeAccount
 * Creates a Convex Auth password account, then writes domain rows.
 */
export const createEmployeeAccount = action({
  args: {
    fullName: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
    tempPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const e = args.email.trim().toLowerCase();

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: args.tempPassword
        ? { id: e, secret: args.tempPassword } // raw password (library hashes)
        : { id: e, secret: "" },               // set later via reset flow
      profile: {
        email: e,
        name: args.fullName,
      },
    });

    await ctx.runMutation(api.employees._insertEmployeeAndRole, {
      userId: user._id,
      fullName: args.fullName,
      email: e,
      role: args.role,
    });

    return { ok: true, userId: user._id };
  },
});
