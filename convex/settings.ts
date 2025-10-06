import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper: Get user role doc
async function getUserRoleDoc(ctx: any, userId: Id<"users">) {
  return await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

// Helper: Audit
async function audit(ctx: any, event: string, userId: Id<"users"> | null, details?: string) {
  await ctx.db.insert("audit_logs", {
    userId: userId ?? undefined,
    event,
    timestamp: Date.now(),
    deviceId: "system",
    location: "",
    details,
  });
}

// Helper: Check admin access
async function requireAdmin(ctx: any, userId: Id<"users">) {
  const userRole = await getUserRoleDoc(ctx, userId);
  if (!userRole || userRole.role !== "admin") {
    await audit(ctx, "access_denied", userId, "admin_required");
    throw new Error("Admin access required");
  }
  return userRole;
}

// Query: Get all users with their roles
export const getAllUsersWithRoles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    const auditLogs = await ctx.db.query("audit_logs").order("desc").take(1000);

    return users.map(user => {
      const role = roles.find(r => r.userId === user._id);
      const lastActivity = auditLogs.find(log => log.userId === user._id);

      return {
        id: user._id,
        name: user.name || user.email || "Unknown User",
        email: user.email || "No email",
        role: role?.role || null,
        locations: role?.locations || [],
        lastActive: lastActivity?.timestamp || null,
        recentActivity: auditLogs
          .filter(log => log.userId === user._id)
          .slice(0, 5)
          .map(log => ({
            event: log.event,
            timestamp: log.timestamp,
            location: log.location,
          })),
      };
    });
  },
});

// Mutation: Update user role
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
    locations: v.array(v.string()),
  },
  handler: async (ctx, { userId: targetUserId, role: newRole, locations }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const existingRole = await getUserRoleDoc(ctx, targetUserId);

    if (existingRole) {
      await ctx.db.patch(existingRole._id, {
        role: newRole,
        locations,
      });
    } else {
      await ctx.db.insert("roles", {
        userId: targetUserId,
        role: newRole,
        locations,
      });
    }

    await audit(ctx, "update_user_role", userId, `targetUserId=${targetUserId},role=${newRole},locations=${locations.join(",")}`);

    return true;
  },
});

// Mutation: Delete user role
export const deleteUserRole = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId: targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const existingRole = await getUserRoleDoc(ctx, targetUserId);
    if (existingRole) {
      await ctx.db.delete(existingRole._id);
    }

    await audit(ctx, "delete_user_role", userId, `targetUserId=${targetUserId}`);

    return true;
  },
});

// Query: Get kiosks
export const getKiosks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const kiosks = await ctx.db.query("kiosks").collect();
    const auditLogs = await ctx.db.query("audit_logs").order("desc").take(1000);

    return kiosks.map(kiosk => {
      const lastSeen = auditLogs.find(log => log.deviceId === kiosk.deviceId)?.timestamp;

      return {
        id: kiosk._id,
        deviceId: kiosk.deviceId,
        location: kiosk.location,
        status: kiosk.status,
        lastSeen,
      };
    });
  },
});

// Query: Get locations summary
export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const residents = await ctx.db.query("residents").collect();
    const kiosks = await ctx.db.query("kiosks").collect();
    const roles = await ctx.db.query("roles").collect();

    const locationNames = [...new Set([
      ...residents.map(r => r.location),
      ...kiosks.map(k => k.location)
    ])];

    return locationNames.map(location => ({
      name: location,
      residentCount: residents.filter(r => r.location === location).length,
      kioskCount: kiosks.filter(k => k.location === location && k.status === "active").length,
      staffCount: roles.filter(r => r.role === "staff" && (r.locations || []).includes(location)).length,
    }));
  },
});

// Mutation: Register new kiosk
export const registerKiosk = mutation({
  args: {
    deviceId: v.string(),
    location: v.string(),
  },
  handler: async (ctx, { deviceId, location }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    // Check if device already exists
    const existing = await ctx.db.query("kiosks").withIndex("by_deviceId", (q: any) => q.eq("deviceId", deviceId)).unique();
    if (existing) throw new Error("Device ID already registered");

    await ctx.db.insert("kiosks", {
      name: `Kiosk ${deviceId.slice(0, 8)}`,
      deviceId,
      location,
      status: "active",
      registeredAt: Date.now(),
      registeredBy: userId,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await audit(ctx, "register_kiosk", userId, `deviceId=${deviceId},location=${location}`);

    return true;
  },
});

// Mutation: Update kiosk
export const updateKiosk = mutation({
  args: {
    kioskId: v.id("kiosks"),
    location: v.string(),
    status: v.union(v.literal("active"), v.literal("disabled"), v.literal("retired")),
  },
  handler: async (ctx, { kioskId, location, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    await ctx.db.patch(kioskId, { location, status });

    await audit(ctx, "update_kiosk", userId, `kioskId=${kioskId},location=${location},status=${status}`);

    return true;
  },
});

// Mutation: Deactivate kiosk
export const deactivateKiosk = mutation({
  args: { kioskId: v.id("kiosks") },
  handler: async (ctx, { kioskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    await ctx.db.patch(kioskId, { status: "disabled" });

    await audit(ctx, "deactivate_kiosk", userId, `kioskId=${kioskId}`);

    return true;
  },
});

// Mutation: Delete kiosk
export const deleteKiosk = mutation({
  args: { kioskId: v.id("kiosks") },
  handler: async (ctx, { kioskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    await ctx.db.delete(kioskId);

    await audit(ctx, "delete_kiosk", userId, `kioskId=${kioskId}`);

    return true;
  },
});

// Query: Get audit logs with filters
export const getAuditLogs = query({
  args: {
    actor: v.optional(v.string()),
    action: v.optional(v.string()),
    location: v.optional(v.string()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
  },
  handler: async (ctx, filters) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const logs = await ctx.db.query("audit_logs").order("desc").take(1000);
    const users = await ctx.db.query("users").collect();

    return logs.map(log => {
      const actor = log.userId ? users.find(u => u._id === log.userId) : null;

      // Determine object type from details (PHI-free)
      let objectType = "System";
      if (log.details?.includes("residentId=")) objectType = "Resident Record";
      else if (log.details?.includes("employeeId=")) objectType = "Employee Record";
      else if (log.details?.includes("kioskId=")) objectType = "Kiosk Device";
      else if (log.details?.includes("alertId=")) objectType = "Compliance Alert";

      return {
        id: log._id,
        timestamp: log.timestamp,
        actorId: log.userId || "system",
        actorName: actor ? (actor.name || actor.email || "Unknown User") : "System",
        event: log.event,
        location: log.location || "System",
        objectType,
        deviceId: log.deviceId,
      };
    });
  },
});

// Query: Get unique audit actors
export const getAuditActors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();

    return users.map(user => {
      const role = roles.find(r => r.userId === user._id);
      return {
        id: user._id,
        name: user.name || user.email || "Unknown User",
        role: role?.role || "No role",
      };
    });
  },
});

// Query: Get unique audit actions
export const getAuditActions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const logs = await ctx.db.query("audit_logs").collect();
    const actions = [...new Set(logs.map(log => log.event))];

    return actions.sort();
  },
});

// Query: Get unique audit locations
export const getAuditLocations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const logs = await ctx.db.query("audit_logs").collect();
    const locations = [...new Set(logs.map(log => log.location).filter(Boolean))];

    return locations.sort();
  },
});

// Query: Get app settings
export const getAppSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const config = await ctx.db.query("config").first();

    return {
      complianceReminderTemplate: config?.complianceReminderTemplate || "",
      guardianInviteTemplate: config?.guardianInviteTemplate || "",
      alertWeekday: config?.alertWeekday || 1,
      alertHour: config?.alertHour || 9,
      alertMinute: config?.alertMinute || 0,
      selfieEnforced: config?.selfieEnforced || false,
      requireClockInForAccess: config?.requireClockInForAccess ?? true,
    };
  },
});

// Mutation: Update app settings
export const updateAppSettings = mutation({
  args: {
    complianceReminderTemplate: v.optional(v.string()),
    guardianInviteTemplate: v.optional(v.string()),
    alertWeekday: v.optional(v.number()),
    alertHour: v.optional(v.number()),
    alertMinute: v.optional(v.number()),
    selfieEnforced: v.optional(v.boolean()),
    requireClockInForAccess: v.optional(v.boolean()),
  },
  handler: async (ctx, settings) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    let config = await ctx.db.query("config").first();

    if (config) {
      // Update existing config
      const updates: any = {};
      if (settings.complianceReminderTemplate !== undefined) updates.complianceReminderTemplate = settings.complianceReminderTemplate;
      if (settings.guardianInviteTemplate !== undefined) updates.guardianInviteTemplate = settings.guardianInviteTemplate;
      if (settings.alertWeekday !== undefined) updates.alertWeekday = settings.alertWeekday;
      if (settings.alertHour !== undefined) updates.alertHour = settings.alertHour;
      if (settings.alertMinute !== undefined) updates.alertMinute = settings.alertMinute;
      if (settings.selfieEnforced !== undefined) updates.selfieEnforced = settings.selfieEnforced;
      if (settings.requireClockInForAccess !== undefined) updates.requireClockInForAccess = settings.requireClockInForAccess;

      await ctx.db.patch(config._id, updates);
    } else {
      // Create new config
      await ctx.db.insert("config", {
        complianceReminderTemplate: settings.complianceReminderTemplate || "",
        guardianInviteTemplate: settings.guardianInviteTemplate || "",
        alertWeekday: settings.alertWeekday || 1,
        alertHour: settings.alertHour || 9,
        alertMinute: settings.alertMinute || 0,
        selfieEnforced: settings.selfieEnforced || false,
        requireClockInForAccess: settings.requireClockInForAccess ?? true,
      });
    }

    await audit(ctx, "update_app_settings", userId, `settings=${Object.keys(settings).join(",")}`);

    return true;
  },
});

// Query: Get user role (enhanced with access control)
export const getUserRole = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const role = await getUserRoleDoc(ctx, userId);
    return {
      role: role?.role || null,
      locations: role?.locations || [],
      isKiosk: false, // Placeholder for kiosk detection
    };
  },
});
