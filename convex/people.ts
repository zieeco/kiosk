import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Add new resident
export const addResident = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    dob: v.optional(v.string()),
  },
  handler: async (ctx, { name, location, dob }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("residents", {
      name,
      location,
      dob,
      createdBy: userId,
      createdAt: Date.now(),
    });
    return true;
  },
});

// Onboard new employee (with invite link)
export const onboardEmployee = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
    location: v.string(),
  },
  handler: async (ctx, { name, email, role, location }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    // Generate secure invite token and expiration
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24h
    const employeeId = await ctx.db.insert("employees", {
      name,
      email,
      role,
      location,
      onboardedBy: userId,
      onboardedAt: Date.now(),
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      hasAcceptedInvite: false,
      invitedAt: Date.now(),
      inviteBounced: false,
      inviteResent: undefined,
    });
    // Audit event
    await ctx.db.insert("audit_logs", {
      userId,
      event: "send_employee_invite",
      timestamp: Date.now(),
      deviceId: "system",
      location: "",
      details: `employeeId=${employeeId},email=${email}`,
    });
    // TODO: Send email using PHI-safe template (action)
    return true;
  },
});

// Broadcast message
export const broadcastMessage = mutation({
  args: {
    message: v.string(),
  },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("broadcasts", {
      message,
      sentBy: userId,
      sentAt: Date.now(),
    });
    return true;
  },
});

// List residents
export const listResidents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const residents = await ctx.db.query("residents").collect();
    return residents.map(resident => ({
      id: resident._id,
      name: resident.name,
      location: resident.location,
      dob: resident.dob,
      createdAt: resident.createdAt,
    }));
  },
});

// Create resident (alias for addResident)
export const createResident = mutation({
  args: {
    residentId: v.optional(v.string()),
    legalName: v.optional(v.string()),
    name: v.optional(v.string()),
    location: v.string(),
    dob: v.optional(v.string()),
    guardians: v.optional(v.array(v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      preferredChannel: v.optional(v.string()),
    }))),
    generateChecklist: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const name = args.legalName || args.name || "Unknown";
    
    const residentId = await ctx.db.insert("residents", {
      name,
      location: args.location,
      dob: args.dob,
      createdBy: userId,
      createdAt: Date.now(),
    });
    
    return { residentId };
  },
});
