import { query, mutation, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { Resend } from "resend";

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

// Create checklist template (admin only)
export const createChecklistTemplate = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    questions: v.array(v.object({
      id: v.string(),
      text: v.string(),
      type: v.union(v.literal("yes_no"), v.literal("text"), v.literal("rating")),
      required: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role || role.role !== "admin") throw new Error("Forbidden");
    
    const templateId = await ctx.db.insert("guardian_checklist_templates", {
      name: args.name,
      description: args.description,
      questions: args.questions,
      createdBy: userId,
      createdAt: Date.now(),
      active: true,
    });
    
    await audit(ctx, "create_checklist_template", userId, `templateId=${templateId}`);
    return templateId;
  },
});

// List all checklist templates
export const listChecklistTemplates = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.db.query("guardian_checklist_templates").collect();
  },
});

// Send checklist to guardian (admin/supervisor)
export const sendChecklistToGuardian = mutation({
  args: {
    residentId: v.id("residents"),
    templateId: v.id("guardian_checklist_templates"),
    guardianEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role || !["admin", "supervisor"].includes(role.role || "")) throw new Error("Forbidden");
    
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    
    const linkId = await ctx.db.insert("guardian_checklist_links", {
      residentId: args.residentId,
      templateId: args.templateId,
      guardianEmail: args.guardianEmail,
      token,
      sentDate: Date.now(),
      expiresAt,
      completed: false,
    });
    
    await audit(ctx, "send_guardian_checklist", userId, `linkId=${linkId}`);
    
    return { linkId, token };
  },
});

// Get checklist by token (public - no auth required)
export const getChecklistByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const link = await ctx.db
      .query("guardian_checklist_links")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    
    if (!link) return null;
    
    const template = await ctx.db.get(link.templateId);
    const resident = await ctx.db.get(link.residentId);
    
    return {
      link,
      template,
      residentName: resident?.name || "Unknown",
      expired: link.expiresAt < Date.now(),
    };
  },
});

// Submit checklist responses (public - no auth required)
export const submitChecklistResponses = mutation({
  args: {
    token: v.string(),
    responses: v.array(v.object({
      questionId: v.string(),
      answer: v.union(v.string(), v.number(), v.boolean()),
    })),
  },
  handler: async (ctx, { token, responses }) => {
    const link = await ctx.db
      .query("guardian_checklist_links")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    
    if (!link) throw new Error("Invalid link");
    if (link.completed) throw new Error("Checklist already completed");
    if (link.expiresAt < Date.now()) throw new Error("Link expired");
    
    await ctx.db.patch(link._id, {
      completed: true,
      completedAt: Date.now(),
      responses,
    });
    
    return { success: true };
  },
});

// List all checklist links (admin/supervisor)
export const listChecklistLinks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const role = await ctx.db.query("roles").withIndex("by_userId", (q) => q.eq("userId", userId)).unique();
    if (!role) throw new Error("Forbidden");
    
    const links = await ctx.db.query("guardian_checklist_links").collect();
    const residents = await ctx.db.query("residents").collect();
    const templates = await ctx.db.query("guardian_checklist_templates").collect();
    
    return links.map(link => {
      const resident = residents.find(r => r._id === link.residentId);
      const template = templates.find(t => t._id === link.templateId);
      
      return {
        ...link,
        residentName: resident?.name || "Unknown",
        templateName: template?.name || "Unknown",
        expired: link.expiresAt < Date.now(),
      };
    });
  },
});

// Internal query for email action
export const internalGetChecklistLink = internalQuery({
  args: { linkId: v.id("guardian_checklist_links") },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get(linkId);
    if (!link) return null;
    
    const template = await ctx.db.get(link.templateId);
    const resident = await ctx.db.get(link.residentId);
    
    return {
      link,
      template,
      resident,
    };
  },
});

// Send checklist email
export const sendChecklistEmail = action({
  args: {
    linkId: v.id("guardian_checklist_links"),
    token: v.string(),
  },
  handler: async (ctx, { linkId, token }) => {
    const data = await ctx.runQuery(internal.guardianChecklists.internalGetChecklistLink, { linkId });
    if (!data) throw new Error("Link not found");
    
    const { link, template, resident } = data;
    const resend = new Resend(process.env.RESEND_API_KEY || process.env.CONVEX_RESEND_API_KEY);
    
    const checklistUrl = `${process.env.SITE_URL || "https://fleet-bobcat-14.convex.site"}/?checklist=${token}`;
    
    const { error } = await resend.emails.send({
      from: "El-Elyon Properties <noreply@myezer.org>",
      to: link.guardianEmail,
      subject: `Guardian Checklist for ${resident?.name}`,
      html: `
        <div>
          <h2>Guardian Checklist</h2>
          <p>You have been sent a checklist to complete for <strong>${resident?.name}</strong>.</p>
          <p>Template: <strong>${template?.name}</strong></p>
          <p>
            <a href="${checklistUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
              Complete Checklist
            </a>
          </p>
          <p>If the button doesn't work, copy and paste this link:</p>
          <p><code>${checklistUrl}</code></p>
          <hr>
          <p>This link will expire in 30 days.</p>
        </div>
      `,
    });
    
    if (error) {
      throw new Error("Failed to send email: " + JSON.stringify(error));
    }
    
    return { success: true };
  },
});
