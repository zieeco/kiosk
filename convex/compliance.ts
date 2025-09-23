import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

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

// Internal: List all residents (no auth)
export const internalListResidents = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("residents").collect();
  },
});

// Internal: List all ISPs for a resident (no auth)
export const internalListResidentIsps = internalQuery({
  args: { residentId: v.id("residents") },
  handler: async (ctx, { residentId }) => {
    return await ctx.db
      .query("isp")
      .withIndex("by_resident", (q) => q.eq("residentId", residentId))
      .order("desc")
      .collect();
  },
});

// Internal: List latest fire evac per location (no auth)
export const internalListLatestFireEvac = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fire_evac").order("desc").collect();
    const byLoc: Record<string, any> = {};
    for (const fe of all) {
      if (!byLoc[fe.location] || fe.version > byLoc[fe.location].version) {
        byLoc[fe.location] = fe;
      }
    }
    return Object.values(byLoc);
  },
});

// Internal: List alerts for location/type
export const internalListAlertsForLocation = internalQuery({
  args: { location: v.string(), type: v.union(v.literal("isp"), v.literal("fire_evac")) },
  handler: async (ctx, { location, type }) => {
    return await ctx.db
      .query("compliance_alerts")
      .withIndex("by_location", (q) => q.eq("location", location))
      .collect()
      .then(alerts => alerts.filter(a => a.type === type));
  },
});

// Internal: Create alert
export const internalCreateAlert = internalMutation({
  args: {
    type: v.union(v.literal("isp"), v.literal("fire_evac")),
    location: v.string(),
    dueAt: v.number(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, { type, location, dueAt, details }) => {
    await ctx.db.insert("compliance_alerts", {
      type,
      location,
      dueAt,
      active: true,
      createdAt: Date.now(),
      details,
    });
    // No PHI in details
    return true;
  },
});

// Internal: List all active alerts
export const internalListAllActiveAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("compliance_alerts").order("desc").collect().then(alerts => alerts.filter(a => a.active));
  },
});

// Internal: List all admins
export const internalListAdmins = internalQuery({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").collect();
    const adminIds = roles.filter((r: any) => r.role === "admin").map((r: any) => r.userId);
    const users = [];
    for (const id of adminIds) {
      const user = await ctx.db.get(id);
      if (user) users.push(user);
    }
    return users;
  },
});

// Query: List active alerts for user (by location)
export const listActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // Get user role/locations
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role) return [];
    const locations = role.locations ?? [];
    // Show all active alerts for user's locations
    return await ctx.db
      .query("compliance_alerts")
      .order("desc")
      .collect()
      .then(alerts => alerts.filter(a => a.active && locations.includes(a.location)));
  },
});

// Mutation: Dismiss alert
export const dismissAlert = mutation({
  args: { alertId: v.id("compliance_alerts") },
  handler: async (ctx, { alertId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const alert = await ctx.db.get(alertId);
    if (!alert || !alert.active) throw new Error("Alert not found");
    await ctx.db.patch(alertId, { active: false, dismissedBy: userId, dismissedAt: Date.now() });
    await audit(ctx, "dismiss_alert", userId, `alertId=${alertId},type=${alert.type},location=${alert.location}`);
    return true;
  },
});

// Mutation: Admin sets alert schedule
export const setAlertSchedule = mutation({
  args: { weekday: v.number(), hour: v.number(), minute: v.number() },
  handler: async (ctx, { weekday, hour, minute }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role || role.role !== "admin") throw new Error("Forbidden");
    // Update config (assume single config row)
    const config = await ctx.db.query("config").first();
    if (config) {
      await ctx.db.patch(config._id, { alertWeekday: weekday, alertHour: hour, alertMinute: minute });
    }
    await audit(ctx, "set_alert_schedule", userId, `weekday=${weekday},hour=${hour},minute=${minute}`);
    return true;
  },
});

// Mutation: Admin uploads Fire Evac plan (sets due +12mo, versioned)
export const uploadFireEvac = mutation({
  args: { location: v.string(), fileId: v.string() },
  handler: async (ctx, { location, fileId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role || role.role !== "admin") throw new Error("Forbidden");
    // Get latest version
    const latest = await ctx.db.query("fire_evac").withIndex("by_location", (q) => q.eq("location", location)).order("desc").take(1);
    const version = latest.length > 0 ? latest[0].version + 1 : 1;
    const dueAt = Date.now() + 1000 * 60 * 60 * 24 * 365; // +12mo
    await ctx.db.insert("fire_evac", {
      location,
      uploadedBy: userId,
      uploadedAt: Date.now(),
      version,
      dueAt,
    });
    await audit(ctx, "upload_fire_evac", userId, `location=${location},fileId=${fileId}`);
    return true;
  },
});

// Mutation: When ISP is published, set due +6mo (called from existing publishIsp)
export const setIspDueDate = mutation({
  args: { residentId: v.id("residents"), ispId: v.id("isp") },
  handler: async (ctx, { residentId, ispId }) => {
    // Set dueAt +6mo
    const dueAt = Date.now() + 1000 * 60 * 60 * 24 * 30 * 6;
    await ctx.db.patch(ispId, { dueAt });
    // Optionally, audit here if needed
    return true;
  },
});

// --- NEW: Get compliance overview for workspace ---
export const getComplianceOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role) throw new Error("Forbidden");
    
    const userLocations = role.locations ?? [];
    const isAdmin = role.role === "admin";
    
    const items = [];
    
    // Get ISP items
    const residents = await ctx.db.query("residents").collect();
    const filteredResidents = isAdmin ? residents : residents.filter(r => userLocations.includes(r.location));
    
    for (const resident of filteredResidents) {
      const isps = await ctx.db
        .query("isp")
        .withIndex("by_resident", (q) => q.eq("residentId", resident._id))
        .order("desc")
        .collect();
      
      const currentIsp = isps.find(i => i.published);
      if (currentIsp && currentIsp.dueAt) {
        const now = Date.now();
        const daysUntilDue = Math.ceil((currentIsp.dueAt - now) / (1000 * 60 * 60 * 24));
        
        let status = "ok";
        if (daysUntilDue < 0) status = "overdue";
        else if (daysUntilDue <= 30) status = "due-soon";
        
        items.push({
          id: `isp-${resident._id}`,
          location: resident.location,
          type: "isp",
          itemName: "Individual Service Plan",
          description: `Location: ${resident.location}`,
          dueDate: currentIsp.dueAt,
          status,
          lastAction: `Updated ${new Date(currentIsp.createdAt).toLocaleDateString()}`,
        });
      }
    }
    
    // Get Fire Evac items
    const fireEvacs = await ctx.db.query("fire_evac").collect();
    const latestByLocation: Record<string, any> = {};
    
    for (const fe of fireEvacs) {
      if (!latestByLocation[fe.location] || fe.version > latestByLocation[fe.location].version) {
        latestByLocation[fe.location] = fe;
      }
    }
    
    for (const [location, plan] of Object.entries(latestByLocation)) {
      if (!isAdmin && !userLocations.includes(location)) continue;
      
      const now = Date.now();
      const daysUntilDue = Math.ceil((plan.dueAt - now) / (1000 * 60 * 60 * 24));
      
      let status = "ok";
      if (daysUntilDue < 0) status = "overdue";
      else if (daysUntilDue <= 30) status = "due-soon";
      
      items.push({
        id: `fire-evac-${plan._id}`,
        location,
        type: "fire_evac",
        itemName: "Fire Evacuation Plan",
        description: `Version ${plan.version}`,
        dueDate: plan.dueAt,
        status,
        lastAction: `Uploaded ${new Date(plan.uploadedAt).toLocaleDateString()}`,
      });
    }
    
    return items;
  },
});

// --- NEW: Get guardian checklist links ---
export const getGuardianChecklistLinks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role) throw new Error("Forbidden");
    
    const userLocations = role.locations ?? [];
    const isAdmin = role.role === "admin";
    
    const links = await ctx.db.query("guardian_checklist_links").collect();
    const residents = await ctx.db.query("residents").collect();
    const templates = await ctx.db.query("guardian_checklist_templates").collect();
    
    const result = [];
    
    for (const link of links) {
      const resident = residents.find(r => r._id === link.residentId);
      if (!resident) continue;
      
      if (!isAdmin && !userLocations.includes(resident.location)) continue;
      
      const template = templates.find(t => t._id === link.templateId);
      const now = Date.now();
      
      result.push({
        id: link._id,
        location: resident.location,
        templateName: template?.name || "Unknown Template",
        completed: link.completed,
        expired: link.expiresAt < now,
        sentDate: link.sentDate,
        expiresAt: link.expiresAt,
      });
    }
    
    return result;
  },
});

// --- NEW: Get fire evacuation plans ---
export const getFireEvacPlans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role) throw new Error("Forbidden");
    
    const userLocations = role.locations ?? [];
    const isAdmin = role.role === "admin";
    
    const fireEvacs = await ctx.db.query("fire_evac").collect();
    const latestByLocation: Record<string, any> = {};
    
    for (const fe of fireEvacs) {
      if (!latestByLocation[fe.location] || fe.version > latestByLocation[fe.location].version) {
        latestByLocation[fe.location] = fe;
      }
    }
    
    const result = [];
    
    for (const [location, plan] of Object.entries(latestByLocation)) {
      if (!isAdmin && !userLocations.includes(location)) continue;
      
      const now = Date.now();
      const daysUntilDue = Math.ceil((plan.dueAt - now) / (1000 * 60 * 60 * 24));
      
      let status = "ok";
      if (daysUntilDue < 0) status = "overdue";
      else if (daysUntilDue <= 30) status = "due-soon";
      
      result.push({
        id: plan._id,
        location,
        version: plan.version,
        lastUpload: plan.uploadedAt,
        nextDue: plan.dueAt,
        status,
      });
    }
    
    return result;
  },
});

// --- NEW: Send compliance reminders ---
export const sendComplianceReminders = mutation({
  args: { itemIds: v.array(v.string()) },
  handler: async (ctx, { itemIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    // Log the reminder action (no PHI in audit)
    await audit(ctx, "send_compliance_reminders", userId, `itemCount=${itemIds.length}`);
    
    // In a real implementation, this would send emails/notifications
    // For now, just return success
    return { sent: itemIds.length };
  },
});

// --- NEW: Export compliance list ---
export const exportComplianceList = mutation({
  args: { itemIds: v.array(v.string()) },
  handler: async (ctx, { itemIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role || role.role !== "admin") throw new Error("Forbidden");
    
    // Log the export action
    await audit(ctx, "export_compliance_list", userId, `itemCount=${itemIds.length}`);
    
    // In a real implementation, this would generate and return a file
    // For now, just return success
    return { exported: itemIds.length };
  },
});

// --- NEW: Resend guardian checklist link ---
export const resendGuardianLink = mutation({
  args: { linkId: v.id("guardian_checklist_links") },
  handler: async (ctx, { linkId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const link = await ctx.db.get(linkId);
    if (!link) throw new Error("Link not found");
    
    // Extend expiration by 30 days
    const newExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    await ctx.db.patch(linkId, { expiresAt: newExpiresAt });
    
    await audit(ctx, "resend_guardian_link", userId, `linkId=${linkId}`);
    
    return true;
  },
});

// Action: Generate alerts (called on schedule)
export const generateComplianceAlerts = action({
  args: {},
  handler: async (ctx) => {
    // For each location, check ISP and Fire Evac due dates
    // Alert if due in <=30d and not already active
    // 1. ISPs
    const residents = await ctx.runQuery(internal.compliance.internalListResidents, {});
    for (const resident of residents) {
      const isps = await ctx.runQuery(internal.compliance.internalListResidentIsps, { residentId: resident._id });
      const currentIsp = isps.find((i: any) => i.published);
      if (currentIsp && currentIsp.dueAt && currentIsp.dueAt - Date.now() <= 1000 * 60 * 60 * 24 * 30) {
        // Check if alert exists
        const alerts = await ctx.runQuery(internal.compliance.internalListAlertsForLocation, { location: resident.location, type: "isp" });
        const alreadyActive = alerts.some((a: any) => a.active && a.dueAt === currentIsp.dueAt);
        if (!alreadyActive) {
          await ctx.runMutation(internal.compliance.internalCreateAlert, {
            type: "isp",
            location: resident.location,
            dueAt: currentIsp.dueAt,
            details: `ISP due soon for resident(s) at ${resident.location}`,
          });
        }
      }
    }
    // 2. Fire Evac
    // For each location, get latest fire_evac
    const fireEvacs = await ctx.runQuery(internal.compliance.internalListLatestFireEvac, {});
    for (const fe of fireEvacs) {
      if (fe.dueAt - Date.now() <= 1000 * 60 * 60 * 24 * 30) {
        const alerts = await ctx.runQuery(internal.compliance.internalListAlertsForLocation, { location: fe.location, type: "fire_evac" });
        const alreadyActive = alerts.some((a: any) => a.active && a.dueAt === fe.dueAt);
        if (!alreadyActive) {
          await ctx.runMutation(internal.compliance.internalCreateAlert, {
            type: "fire_evac",
            location: fe.location,
            dueAt: fe.dueAt,
            details: `Fire Evac plan due soon for ${fe.location}`,
          });
        }
      }
    }
    return true;
  },
});

// Action: Send alert emails (no PHI, just links)
import { Resend } from "resend";
export const sendAlertEmails = action({
  args: {},
  handler: async (ctx) => {
    // For each active alert, email all admins
    const alerts = await ctx.runQuery(internal.compliance.internalListAllActiveAlerts, {});
    const admins = (await ctx.runQuery(internal.compliance.internalListAdmins, {})) as any[];
    const resend = new Resend(process.env.CONVEX_RESEND_API_KEY);
    for (const alert of alerts) {
      for (const admin of admins) {
        if (!admin || typeof admin.email !== "string") continue;
        await resend.emails.send({
          from: "Chef Compliance <noreply@chef.app>",
          to: admin.email,
          subject: `Compliance Alert: ${alert.type.toUpperCase()} due soon`,
          html: `<p>A compliance item (${alert.type}) is due soon for location: ${alert.location}.</p>
          <p><a href=\"https://your-app-url.com/compliance\">View details in Chef (secure login required)</a></p>`,
        });
      }
    }
    return true;
  },
});
