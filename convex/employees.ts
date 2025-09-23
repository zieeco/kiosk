import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// List employees with all fields expected by the frontend
export const listEmployees = query({
  args: {},
  handler: async (ctx) => {
    const employees = await ctx.db.query("employees").collect();
    // Return all fields, and mock roles/locations/status for demo
    return employees.map((emp) => ({
      id: emp._id,
      name: emp.name,
      workEmail: emp.workEmail || emp.email || "",
      phone: emp.phone ?? "",
      roles: [emp.role || "staff"],
      locations: [emp.location || "Main"],
      employmentStatus: emp.employmentStatus || "active",
      invitedAt: emp.invitedAt ?? null,
      hasAcceptedInvite: emp.hasAcceptedInvite ?? false,
    }));
  },
});

// Get available locations (mocked for now)
export const getAvailableLocations = query({
  args: {},
  handler: async (ctx) => {
    // Return a static list for demo
    return ["Main", "North", "South", "East", "West"];
  },
});

// Bulk assign employees (mock, does nothing)
export const bulkAssignEmployees = mutation({
  args: {
    employeeIds: v.array(v.id("employees")),
    addRoles: v.optional(v.array(v.string())),
    removeRoles: v.optional(v.array(v.string())),
    addLocations: v.optional(v.array(v.string())),
    removeLocations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // No-op for demo, just return changed count
    return { changed: args.employeeIds.length };
  },
});

// Get invite details by token
export const getInviteDetails = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const employee = await ctx.db
      .query("employees")
      .filter((q) => q.eq(q.field("inviteToken"), token))
      .first();
    
    if (!employee) return null;
    
    const expired = employee.inviteExpiresAt ? employee.inviteExpiresAt < Date.now() : false;
    const alreadyAccepted = employee.hasAcceptedInvite ?? false;
    
    let status = "pending";
    if (alreadyAccepted) status = "already_accepted";
    else if (expired) status = "expired";
    
    return {
      name: employee.name,
      email: employee.workEmail || employee.email || "",
      employeeName: employee.name,
      workEmail: employee.workEmail || employee.email || "",
      role: employee.role || "staff",
      location: employee.location || "Main",
      expired,
      status,
    };
  },
});

// Accept invite
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const employee = await ctx.db
      .query("employees")
      .filter((q) => q.eq(q.field("inviteToken"), token))
      .first();
    
    if (!employee) throw new Error("Invalid invite token");
    if (employee.inviteExpiresAt && employee.inviteExpiresAt < Date.now()) {
      throw new Error("Invite has expired");
    }
    
    await ctx.db.patch(employee._id, {
      hasAcceptedInvite: true,
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    });
    
    return true;
  },
});
