import { mutation } from "./_generated/server";
import { v } from "convex/values"; // Added for v.string()
// import { getAuthUserId } from "@convex-dev/auth/server"; // Removed as per plan
// import { Id } from "./_generated/dataModel"; // Removed as Id<"users"> is no longer used

// Helper: Get user role doc
async function getUserRoleDoc(ctx: any, clerkUserId: string) {
  return await ctx.db
    .query("roles")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

// Helper: Check if user has admin access
async function requireAdminAccess(ctx: any, clerkUserId: string) {
  const userRole = await getUserRoleDoc(ctx, clerkUserId);
  if (!userRole || userRole.role !== "admin") {
    throw new Error("Admin access required");
  }
  return userRole;
}

// Helper: Delete user and all related records
async function deleteUserAndRelatedRecords(ctx: any, targetClerkUserId: string) {
  // 1. Delete shifts
  const shifts = await ctx.db
    .query("shifts")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", targetClerkUserId))
    .collect();
  for (const shift of shifts) {
    await ctx.db.delete(shift._id);
  }

  // 2. Delete resident logs
  const residentLogs = await ctx.db
    .query("resident_logs")
    .withIndex("by_authorId", (q: any) => q.eq("authorId", targetClerkUserId))
    .collect();
  for (const log of residentLogs) {
    await ctx.db.delete(log._id);
  }

  // 3. Delete ISP access logs
  const ispAccessLogs = await ctx.db
    .query("isp_access_logs")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", targetClerkUserId))
    .collect();
  for (const log of ispAccessLogs) {
    await ctx.db.delete(log._id);
  }

  // 4. Delete role record
  const roleDoc = await ctx.db
    .query("roles")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", targetClerkUserId))
    .unique();
  if (roleDoc) {
    await ctx.db.delete(roleDoc._id);
  }

  // 5. Delete auth accounts
  const authAccounts = await ctx.db
    .query("authAccounts")
    .filter((q: any) => q.eq(q.field("clerkUserId"), targetClerkUserId))
    .collect();
  for (const authAccount of authAccounts) {
    await ctx.db.delete(authAccount._id);
  }

  // 6. Delete auth sessions
  const authSessions = await ctx.db
    .query("authSessions")
    .filter((q: any) => q.eq(q.field("clerkUserId"), targetClerkUserId))
    .collect();
  for (const session of authSessions) {
    await ctx.db.delete(session._id);
  }

  // No direct deletion of "user" account as it's now tied to "employees" table
  // and identified by clerkUserId (string)
}

// Clean up orphaned users (users without employee records)
export const cleanupOrphanedUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkUserId = identity.subject;
    await requireAdminAccess(ctx, clerkUserId);
    
    const allEmployees = await ctx.db.query("employees").collect();
    const allRoles = await ctx.db.query("roles").collect();
    
    // Create a set of clerkUserIds that have employee records
    const employeeClerkUserIds = new Set(
      allEmployees.map(emp => emp.clerkUserId).filter(Boolean)
    );
    
    // Create a set of clerkUserIds that have roles
    const roleClerkUserIds = new Set(allRoles.map(role => role.clerkUserId));
    
    const deletedUsers = [];
    
    // Iterate through roles to find those without a corresponding employee
    for (const role of allRoles) {
      // Skip the current admin user's role
      if (role.clerkUserId === clerkUserId) continue;
      
      // A role is orphaned if its clerkUserId doesn't have an employee record
      if (!employeeClerkUserIds.has(role.clerkUserId)) {
        await deleteUserAndRelatedRecords(ctx, role.clerkUserId);
        deletedUsers.push({
          clerkUserId: role.clerkUserId,
          role: role.role,
        });
      }
    }
    
    return {
      success: true,
      totalEmployees: allEmployees.length,
      orphanedRolesFound: deletedUsers.length,
      deleted: deletedUsers,
    };
  },
});
