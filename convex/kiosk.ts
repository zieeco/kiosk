import { query, mutation, action } from "./_generated/server";
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

// Helper: Log audit event
async function logAuditHelper(ctx: any, event: string, deviceId: string, location: string, details?: string) {
  const userId = await getAuthUserId(ctx);
  await ctx.db.insert("audit_logs", {
    userId,
    event,
    timestamp: Date.now(),
    deviceId,
    location,
    details,
  });
}

// Resident-related functions
export const listResidents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("residents").collect();
  },
});

export const getResident = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    return await ctx.db.get(residentId);
  },
});

export const logResidentView = mutation({
  args: { residentId: v.id("residents"), tab: v.string() },
  handler: async (ctx, { residentId, tab }) => {
    const userId = await getAuthUserId(ctx);
    const resident = await ctx.db.get(residentId);
    await ctx.db.insert("audit_logs", {
      userId: userId ?? undefined,
      event: "view_resident_tab",
      timestamp: Date.now(),
      deviceId: "system",
      location: resident?.location ?? "unknown",
      details: `residentId=${residentId},tab=${tab}`,
    });
    return true;
  },
});

export const listResidentLogs = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    return await ctx.db.query("resident_logs").withIndex("by_resident", (q) => q.eq("residentId", residentId)).order("desc").collect();
  },
});

// --- NEW: Create resident log (versioned) ---
export const createResidentLog = mutation({
  args: {
    residentId: v.id("residents"),
    template: v.string(),
    fields: v.object({
      mood: v.string(),
      notes: v.string(),
    }),
  },
  handler: async (ctx, { residentId, template, fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    // Only staff can log
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "staff") throw new Error("Forbidden");
    // Must have acknowledged current ISP
    const canLog = await ctx.runQuery(module.exports.canLogForResident, { residentId });
    if (!canLog) throw new Error("You must acknowledge the current ISP before submitting a log.");
    // Get latest log for versioning
    const logs = await ctx.db.query("resident_logs").withIndex("by_resident", (q) => q.eq("residentId", residentId)).order("desc").take(1);
    const latest = logs.length > 0 ? logs[0] : null;
    const version = latest ? latest.version + 1 : 1;
    const now = Date.now();
    const logId = await ctx.db.insert("resident_logs", {
      residentId,
      authorId: userId,
      template,
      content: JSON.stringify(fields),
      version,
      createdAt: now,
    });
    const resident = await ctx.db.get(residentId);
    await logAuditHelper(ctx, "create_log", "system", resident?.location ?? "unknown", `residentId=${residentId}`);
    return logId;
  },
});

// --- NEW: Edit resident log (creates new version) ---
export const editResidentLog = mutation({
  args: {
    logId: v.id("resident_logs"),
    fields: v.object({
      mood: v.string(),
      notes: v.string(),
    }),
  },
  handler: async (ctx, { logId, fields }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    const oldLog = await ctx.db.get(logId);
    if (!oldLog) throw new Error("Log not found");
    if (oldLog.authorId !== userId) throw new Error("You can only edit your own logs.");
    // Only staff can edit
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "staff") throw new Error("Forbidden");
    // Create new version
    const logs = await ctx.db.query("resident_logs").withIndex("by_resident", (q) => q.eq("residentId", oldLog.residentId)).order("desc").take(1);
    const latest = logs.length > 0 ? logs[0] : null;
    const version = latest ? latest.version + 1 : 1;
    const now = Date.now();
    const newLogId = await ctx.db.insert("resident_logs", {
      residentId: oldLog.residentId,
      authorId: userId,
      template: oldLog.template,
      content: JSON.stringify(fields),
      version,
      createdAt: now,
    });
    const resident = await ctx.db.get(oldLog.residentId);
    await logAuditHelper(ctx, "edit_log", "system", resident?.location ?? "unknown", `residentId=${oldLog.residentId}`);
    return newLogId;
  },
});

// ISP: Author or update ISP (Supervisor/Admin only)
export const authorIsp = mutation({
  args: {
    residentId: v.id("residents"),
    content: v.string(),
  },
  handler: async (ctx, { residentId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || (roleDoc.role !== "admin" && roleDoc.role !== "supervisor")) {
      throw new Error("Forbidden");
    }
    const resident = await ctx.db.get(residentId);
    if (!resident) throw new Error("Resident not found");
    // Save as draft (not published)
    await ctx.db.insert("isp", {
      residentId,
      goals: [],
      published: false,
      createdAt: Date.now(),
    });
    await logAuditHelper(ctx, "author_isp", "system", resident.location, `residentId=${residentId}`);
    return true;
  },
});

// ISP: Publish ISP (Supervisor/Admin only)
export const publishIsp = mutation({
  args: {
    residentId: v.id("residents"),
  },
  handler: async (ctx, { residentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || (roleDoc.role !== "admin" && roleDoc.role !== "supervisor")) {
      throw new Error("Forbidden");
    }
    const resident = await ctx.db.get(residentId);
    if (!resident) throw new Error("Resident not found");
    // Find latest ISP draft for this resident
    const drafts = await ctx.db
      .query("isp")
      .withIndex("by_resident", (q: any) => q.eq("residentId", residentId))
      .order("desc")
      .collect();
    const latestDraft = drafts.find((d: any) => !d.published);
    if (!latestDraft) throw new Error("No draft ISP to publish");
    // Set published, set due date +6 months
    const dueAt = Date.now() + 1000 * 60 * 60 * 24 * 30 * 6;
    await ctx.db.patch(latestDraft._id, { published: true, dueAt });
    // Remove all previous acknowledgments for this resident (new ISP)
    const acks = await ctx.db
      .query("isp_acknowledgments")
      .withIndex("by_resident_and_user", (q: any) => q.eq("residentId", residentId))
      .collect();
    for (const ack of acks) {
      await ctx.db.delete(ack._id);
    }
    await logAuditHelper(ctx, "publish_isp", "system", resident.location, `residentId=${residentId}`);
    return true;
  },
});

// ISP: List current ISP for resident
export const getCurrentIsp = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    const isps = await ctx.db
      .query("isp")
      .withIndex("by_resident", (q: any) => q.eq("residentId", residentId))
      .order("desc")
      .collect();
    return isps.find((i: any) => i.published) || null;
  },
});

// ISP: List all ISPs for resident (for supervisor/admin)
export const listResidentIsps = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || (roleDoc.role !== "admin" && roleDoc.role !== "supervisor")) {
      throw new Error("Forbidden");
    }
    return await ctx.db
      .query("isp")
      .withIndex("by_resident", (q: any) => q.eq("residentId", residentId))
      .order("desc")
      .collect();
  },
});

// ISP: Acknowledge current ISP (staff only)
export const acknowledgeIsp = mutation({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "staff") throw new Error("Forbidden");
    const currentIsp = await ctx.runQuery(module.exports.getCurrentIsp, { residentId });
    if (!currentIsp) throw new Error("No published ISP");
    // Check if already acknowledged
    const ack = await ctx.db
      .query("isp_acknowledgments")
      .withIndex("by_resident_and_user", (q: any) =>
        q.eq("residentId", residentId).eq("userId", userId)
      )
      .unique();
    if (ack) throw new Error("Already acknowledged");
    await ctx.db.insert("isp_acknowledgments", {
      residentId,
      userId,
      ispId: currentIsp._id,
      acknowledgedIsp: currentIsp._id,
      acknowledgedAt: Date.now(),
    });
    const resident = await ctx.db.get(residentId);
    await logAuditHelper(ctx, "acknowledge_isp", "system", resident?.location ?? "unknown", `residentId=${residentId}`);
    return true;
  },
});

// ISP: List acknowledgments for a resident (supervisor/admin)
export const listIspAcknowledgments = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || (roleDoc.role !== "admin" && roleDoc.role !== "supervisor")) {
      throw new Error("Forbidden");
    }
    // Get current ISP
    const currentIsp = await ctx.runQuery(module.exports.getCurrentIsp, { residentId });
    if (!currentIsp) return [];
    // Get all staff for this location
    const staff = await ctx.db
      .query("roles")
      .withIndex("by_userId", (q: any) => q)
      .collect();
    const staffForLocation = staff.filter(
      (r: any) => r.role === "staff" && (r.locations ?? []).includes(currentIsp.location)
    );
    // Get all acknowledgments for this ISP
    const acks = await ctx.db
      .query("isp_acknowledgments")
      .withIndex("by_resident_and_user", (q: any) => q.eq("residentId", residentId))
      .collect();
    return staffForLocation.map((s: any) => {
      const ack = acks.find((a: any) => a.userId === s.userId && a.acknowledgedIsp === currentIsp._id);
      return {
        userId: s.userId,
        acknowledged: !!ack,
        acknowledgedAt: ack?.acknowledgedAt ?? null,
      };
    });
  },
});

// Enforce acknowledgment before staff can log for a resident
export const canLogForResident = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "staff") return false;
    // Must have acknowledged current ISP
    const currentIsp = await ctx.runQuery(module.exports.getCurrentIsp, { residentId });
    if (!currentIsp) return false;
    const ack = await ctx.db
      .query("isp_acknowledgments")
      .withIndex("by_resident_and_user", (q: any) =>
        q.eq("residentId", residentId).eq("userId", userId)
      )
      .unique();
    return !!ack;
  },
});

// Get kiosk by deviceId
export const getKioskByDevice = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await ctx.db.query("kiosks").withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId)).unique();
  },
});

// Get config
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("config").first();
  },
});

// Log audit event (from frontend)
export const logAudit = mutation({
  args: { event: v.string(), deviceId: v.string(), location: v.string(), details: v.optional(v.string()) },
  handler: async (ctx, { event, deviceId, location, details }) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("audit_logs", {
      userId: userId ?? undefined,
      event,
      timestamp: Date.now(),
      deviceId,
      location,
      details,
    });
    return true;
  },
});

// List audit logs for a resident (log actions)
export const getResidentAuditTrail = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc) throw new Error("Forbidden");
    const resident = await ctx.db.get(args.residentId);
    if (!resident) throw new Error("Not found");
    if (roleDoc.role !== "admin" && !(roleDoc.locations ?? []).includes(resident.location)) {
      throw new Error("Forbidden");
    }
    // Only log actions related to logs for this resident
    const logs = await ctx.db
      .query("audit_logs")
      .order("desc")
      .collect();
    return logs.filter(
      (l) =>
        l.details &&
        l.details.includes(`residentId=${args.residentId}`) &&
        [
          "create_log",
          "edit_log",
          "view_resident_tab",
          "acknowledge_isp",
          "publish_isp",
          "author_isp",
        ].includes(l.event)
    );
  },
});

// --- NEW: List resident documents (HR files) ---
export const listResidentDocuments = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    // Find all users for this resident's location
    const resident = await ctx.db.get(residentId);
    if (!resident) throw new Error("Resident not found");
    // Find all users at this location
    const users = await ctx.db.query("users").collect();
    const userIds = users.map((u: any) => u._id);
    // Find all hr_files for users at this location
    const hrFiles = await ctx.db
      .query("hr_files")
      .withIndex("by_userId", (q) => q)
      .collect();
    // Only return files for users at this location
    return hrFiles
      .filter((f: any) => userIds.includes(f.userId))
      .map((f: any) => ({
        ...f,
      }));
  },
});

// --- NEW: Get resident document download URL ---
export const getResidentDocumentUrl = mutation({
  args: { fileId: v.string(), residentId: v.id("residents") },
  handler: async (ctx, { fileId, residentId }) => {
    // Find the hr_file
    const hrFile = await ctx.db
      .query("hr_files")
      .withIndex("by_userId", (q) => q)
      .collect();
    const file = hrFile.find((f: any) => f.fileId === fileId);
    if (!file) throw new Error("File not found");
    // For demo, just return a placeholder URL
    // In real app, you would use Convex storage and return a signed URL
    return `https://example.com/download/${fileId}`;
  },
});

// --- NEW: Get today's activity for dashboard ---
export const getTodaysActivity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "admin") throw new Error("Forbidden");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const logs = await ctx.db
      .query("audit_logs")
      .order("desc")
      .collect();
    
    return logs.filter(log => log.timestamp >= todayTimestamp);
  },
});

// --- NEW: Get ISP acknowledgment summary for dashboard ---
export const getIspAcknowledgmentSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const roleDoc = await getUserRoleDoc(ctx, userId);
    if (!roleDoc || roleDoc.role !== "admin") throw new Error("Forbidden");
    
    // Get all locations
    const residents = await ctx.db.query("residents").collect();
    const locations = [...new Set(residents.map(r => r.location))];
    
    const summary = [];
    
    for (const location of locations) {
      const locationResidents = residents.filter(r => r.location === location);
      let notAcknowledged = 0;
      let acknowledged = 0;
      
      for (const resident of locationResidents) {
        const currentIsp = await ctx.runQuery(module.exports.getCurrentIsp, { residentId: resident._id });
        if (currentIsp) {
          const acks = await ctx.db
            .query("isp_acknowledgments")
            .withIndex("by_resident_and_user", (q: any) => q.eq("residentId", resident._id))
            .collect();
          
          const staffRoles = await ctx.db
            .query("roles")
            .collect();
          const staffForLocation = staffRoles.filter(
            (r: any) => r.role === "staff" && (r.locations ?? []).includes(location)
          );
          
          const acknowledgedCount = acks.filter(ack => 
            ack.acknowledgedIsp === currentIsp._id
          ).length;
          
          if (acknowledgedCount < staffForLocation.length) {
            notAcknowledged += (staffForLocation.length - acknowledgedCount);
          }
          acknowledged += acknowledgedCount;
        }
      }
      
      summary.push({
        location,
        notAcknowledged,
        acknowledged
      });
    }
    
    return summary;
  },
});
