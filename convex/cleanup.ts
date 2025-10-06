import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper: Get user role doc
async function getUserRoleDoc(ctx: any, userId: Id<"users">) {
  return await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

// Helper: Check if user has admin access
async function requireAdminAccess(ctx: any, userId: Id<"users">) {
  const userRole = await getUserRoleDoc(ctx, userId);
  if (!userRole || userRole.role !== "admin") {
    throw new Error("Admin access required");
  }
  return userRole;
}

// Helper: Delete user and all related records
async function deleteUserAndRelatedRecords(ctx: any, targetUserId: Id<"users">) {
  // 1. Delete shifts
  const shifts = await ctx.db
    .query("shifts")
    .withIndex("by_userId", (q: any) => q.eq("userId", targetUserId))
    .collect();
  for (const shift of shifts) {
    await ctx.db.delete(shift._id);
  }

  // 2. Delete resident logs
  const residentLogs = await ctx.db
    .query("resident_logs")
    .withIndex("by_authorId", (q: any) => q.eq("authorId", targetUserId))
    .collect();
  for (const log of residentLogs) {
    await ctx.db.delete(log._id);
  }

  // 3. Delete ISP access logs
  const ispAccessLogs = await ctx.db
    .query("isp_access_logs")
    .withIndex("by_userId", (q: any) => q.eq("userId", targetUserId))
    .collect();
  for (const log of ispAccessLogs) {
    await ctx.db.delete(log._id);
  }

  // 4. Delete role record
  const roleDoc = await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", targetUserId))
    .unique();
  if (roleDoc) {
    await ctx.db.delete(roleDoc._id);
  }

  // 5. Delete auth accounts
  const authAccounts = await ctx.db
    .query("authAccounts")
    .filter((q: any) => q.eq(q.field("userId"), targetUserId))
    .collect();
  for (const authAccount of authAccounts) {
    await ctx.db.delete(authAccount._id);
  }

  // 6. Delete auth sessions
  const authSessions = await ctx.db
    .query("authSessions")
    .filter((q: any) => q.eq(q.field("userId"), targetUserId))
    .collect();
  for (const session of authSessions) {
    await ctx.db.delete(session._id);
  }

  // 7. Delete the user account
  await ctx.db.delete(targetUserId);
}

// Clean up orphaned users (users without employee records)
export const cleanupOrphanedUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdminAccess(ctx, userId);
    
    const allUsers = await ctx.db.query("users").collect();
    const allEmployees = await ctx.db.query("employees").collect();
    const allRoles = await ctx.db.query("roles").collect();
    
    // Create a set of user emails that have employee records
    const employeeUserEmails = new Set(
      allEmployees.map(emp => emp.email || emp.workEmail).filter(Boolean)
    );
    
    // Create a set of user IDs that have roles
    const roleUserIds = new Set(allRoles.map(role => role.userId));
    
    const deletedUsers = [];
    
    for (const user of allUsers) {
      // Skip the current admin user
      if (user._id === userId) continue;
      
      // Check if user has an employee record
      const hasEmployee = user.email && employeeUserEmails.has(user.email);
      
      // A user is orphaned if they don't have an employee record
      // (even if they have a role, because roles should only exist for employees)
      if (!hasEmployee) {
        await deleteUserAndRelatedRecords(ctx, user._id);
        deletedUsers.push({
          id: user._id,
          email: user.email,
          name: user.name,
        });
      }
    }
    
    return {
      success: true,
      totalUsers: allUsers.length,
      orphanedFound: deletedUsers.length,
      deleted: deletedUsers,
    };
  },
});
