import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { Resend } from "resend";

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

// Helper: Check if user has access to care functions
async function requireCareAccess(ctx: any, userId: Id<"users">) {
  const userRole = await getUserRoleDoc(ctx, userId);
  if (!userRole || !["admin", "supervisor", "staff"].includes(userRole.role)) {
    await audit(ctx, "access_denied", userId, "care_access_required");
    throw new Error("Care access required");
  }
  return userRole;
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

// Add new resident
export const addResident = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    dateOfBirth: v.string(),
  },
  handler: async (ctx, { name, location, dateOfBirth }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    await ctx.db.insert("residents", {
      name,
      location,
      dateOfBirth,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await audit(ctx, "add_resident", userId, `location=${location}`);
    return true;
  },
});

// --- ACTION: Send Employee Invite Email ---
export const sendEmployeeInviteEmail = action({
  args: {
    email: v.string(),
    name: v.string(),
    inviteUrl: v.string(),
    role: v.string(),
    locations: v.array(v.string()),
  },
  handler: async (ctx, { email, name, inviteUrl, role, locations }) => {
    const resend = new Resend(process.env.RESEND_API_KEY || process.env.CONVEX_RESEND_API_KEY);

    const subject = "You're invited to join the Care App";
    const html = `
      <div>
        <h2>Hello ${name || "there"},</h2>
        <p>You have been invited to join the Care App as a <b>${role}</b>.</p>
        <p>Assigned locations: <b>${locations.join(", ") || "None"}</b></p>
        <p>
          <a href="${inviteUrl}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept your invite</a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><code>${inviteUrl}</code></p>
        <hr>
        <p>This invite will expire in 7 days.</p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: "El-Elyon Properties <noreply@myezer.org>",
      to: email,
      subject,
      html,
    });

    if (error) {
      throw new Error("Failed to send invite email: " + JSON.stringify(error));
    }
    return { success: true };
  },
});

// Onboard new employee (admin only)
export const onboardEmployee = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
    locations: v.array(v.string()),
  },
  handler: async (ctx, { name, email, role, locations }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    // Generate secure invite token and expiration
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days

    const employeeId = await ctx.db.insert("employees", {
      id: token,
      name,
      workEmail: email,
      role: role as "admin" | "supervisor" | "staff",
      locations,
      invitedAt: Date.now(),
      invitedBy: userId,
      hasAcceptedInvite: false,
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });

    await audit(ctx, "send_employee_invite", userId, `employeeId=${employeeId},email=${email}`);

    // Build invite URL using the production deployment URL
    const baseUrl = 'https://fleet-bobcat-14.convex.app';
    const inviteUrl = `${baseUrl}/?invite=${token}`;

    // Send invite email via Resend action
    // NOTE: Mutations cannot call actions directly. The client should call sendEmployeeInviteEmail after onboarding.
    return { employeeId, inviteToken: token, inviteUrl, email, name, role, locations };
  },
});

// List residents (care staff access)
export const listResidents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    const residents = await ctx.db.query("residents").collect();
    return residents.map(resident => ({
      id: resident._id,
      name: resident.name,
      location: resident.location,
      dateOfBirth: resident.dateOfBirth,
      createdBy: resident.createdBy,
      createdAt: resident.createdAt,
    }));
  },
});

// Create resident (care staff access)
export const createResident = mutation({
  args: {
    name: v.string(),
    location: v.string(),
    dateOfBirth: v.string(),
    guardians: v.optional(v.array(v.object({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
      preferredChannel: v.string(),
    }))),
    generateChecklist: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    const residentId = await ctx.db.insert("residents", {
      name: args.name,
      location: args.location,
      dateOfBirth: args.dateOfBirth,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await audit(ctx, "create_resident", userId, `residentId=${residentId},location=${args.location}`);
    
    // Create guardians if provided
    const createdGuardianIds: Id<"guardians">[] = [];
    if (args.guardians && args.guardians.length > 0) {
      for (const guardian of args.guardians) {
        if (guardian.name.trim() && guardian.email.trim() && guardian.phone.trim()) {
          const guardianId = await ctx.db.insert("guardians", {
            name: guardian.name.trim(),
            email: guardian.email.trim(),
            phone: guardian.phone.trim(),
            residentIds: [residentId],
            createdBy: userId,
            createdAt: Date.now(),
          });
          createdGuardianIds.push(guardianId);
          await audit(ctx, "create_guardian", userId, `guardianId=${guardianId}`);
        }
      }
    }
    
    // Generate checklist if requested
    if (args.generateChecklist && createdGuardianIds.length > 0) {
      // Get the default template
      const templates = await ctx.db.query("guardian_checklist_templates").collect();
      const defaultTemplate = templates.find(t => t.active) || templates[0];
      
      if (defaultTemplate) {
        for (const guardianId of createdGuardianIds) {
          const guardian = await ctx.db.get(guardianId);
          if (guardian && guardian.email) {
            const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
            const linkId = await ctx.db.insert("guardian_checklist_links", {
              residentId, templateId: defaultTemplate._id, guardianEmail: guardian.email,
              token, sentDate: Date.now(), expiresAt, completed: false,
            });
            await ctx.scheduler.runAfter(0, api.guardianChecklists.sendChecklistEmail, { linkId, token });
          }
        }
      }
    }
    
    return residentId;
  },
});

// List guardians (care staff access)
export const listGuardians = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    const guardians = await ctx.db.query("guardians").collect();
    const residents = await ctx.db.query("residents").collect();
    
    return guardians.map(guardian => {
      const guardianResidents = residents.filter(r => 
        guardian.residentIds?.includes(r._id)
      );
      
      return {
        id: guardian._id,
        name: guardian.name,
        email: guardian.email,
        phone: guardian.phone,
        relationship: guardian.relationship,
        address: guardian.address,
        residentIds: guardian.residentIds || [],
        residentNames: guardianResidents.map(r => r.name),
        preferredChannel: "email", // Default to email
        createdBy: guardian.createdBy,
        createdAt: guardian.createdAt,
      };
    });
  },
});

// Create guardian (care staff access)
export const createGuardian = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    residentIds: v.array(v.id("residents")),
  },
  handler: async (ctx, { name, email, phone, residentIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    const guardianId = await ctx.db.insert("guardians", {
      name,
      relationship: "guardian",
      email,
      phone,
      residentIds,
      createdBy: userId,
      createdAt: Date.now(),
    });

    await audit(ctx, "create_guardian", userId, `guardianId=${guardianId},residentCount=${residentIds.length}`);
    return guardianId;
  },
});

// Update guardian (care staff access)
export const updateGuardian = mutation({
  args: {
    guardianId: v.id("guardians"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    relationship: v.optional(v.string()),
    address: v.optional(v.string()),
    residentIds: v.array(v.id("residents")),
  },
  handler: async (ctx, { guardianId, name, email, phone, relationship, address, residentIds }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireCareAccess(ctx, userId);

    const guardian = await ctx.db.get(guardianId);
    if (!guardian) throw new Error("Guardian not found");

    await ctx.db.patch(guardianId, {
      name,
      email,
      phone,
      relationship,
      address,
      residentIds,
    });

    await audit(ctx, "update_guardian", userId, `guardianId=${guardianId}`);
    return guardianId;
  },
});

// Delete guardian (admin only) - CASCADE DELETE
export const deleteGuardian = mutation({
  args: { guardianId: v.id("guardians") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const guardian = await ctx.db.get(args.guardianId);
    if (!guardian) throw new Error("Guardian not found");

    // 1. Delete all guardian checklist links
    const checklistLinks = await ctx.db
      .query("guardian_checklist_links")
      .collect();
    for (const link of checklistLinks) {
      if (link.guardianEmail === guardian.email) {
        await ctx.db.delete(link._id);
      }
    }

    // 2. Delete the guardian record
    await ctx.db.delete(args.guardianId);
    
    await audit(ctx, "delete_guardian", userId, `guardianId=${args.guardianId},email=${guardian.email}`);
    return { success: true };
  },
});

// Delete resident (admin only) - CASCADE DELETE
export const deleteResident = mutation({
  args: { residentId: v.id("residents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await requireAdmin(ctx, userId);

    const resident = await ctx.db.get(args.residentId);
    if (!resident) throw new Error("Resident not found");

    // 1. Delete all resident logs
    const residentLogs = await ctx.db
      .query("resident_logs")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const log of residentLogs) {
      await ctx.db.delete(log._id);
    }

    // 2. Delete all ISP files
    const ispFiles = await ctx.db
      .query("isp_files")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const ispFile of ispFiles) {
      if (ispFile.fileStorageId) {
        await ctx.storage.delete(ispFile.fileStorageId);
      }
      await ctx.db.delete(ispFile._id);
    }

    // 3. Delete all ISP access logs
    const ispAccessLogs = await ctx.db
      .query("isp_access_logs")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const log of ispAccessLogs) {
      await ctx.db.delete(log._id);
    }

    // 4. Delete all ISP records
    const ispRecords = await ctx.db
      .query("isp")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const isp of ispRecords) {
      await ctx.db.delete(isp._id);
    }

    // 5. Delete all ISP acknowledgments
    const ispAcks = await ctx.db
      .query("isp_acknowledgments")
      .withIndex("by_resident_and_user", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const ack of ispAcks) {
      await ctx.db.delete(ack._id);
    }

    // 6. Delete all fire evacuation plans
    const fireEvacPlans = await ctx.db
      .query("fire_evac")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const plan of fireEvacPlans) {
      if (plan.fileStorageId) {
        await ctx.storage.delete(plan.fileStorageId);
      }
      await ctx.db.delete(plan._id);
    }

    // 7. Delete all guardian checklist links
    const checklistLinks = await ctx.db
      .query("guardian_checklist_links")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    for (const link of checklistLinks) {
      await ctx.db.delete(link._id);
    }

    // 8. Delete all compliance alerts for this resident
    const complianceAlerts = await ctx.db.query("compliance_alerts").collect();
    for (const alert of complianceAlerts) {
      if (alert.metadata?.residentId === args.residentId) {
        await ctx.db.delete(alert._id);
      }
    }

    // 9. Remove resident from guardian records
    const guardians = await ctx.db.query("guardians").collect();
    for (const guardian of guardians) {
      if (guardian.residentIds?.includes(args.residentId)) {
        const updatedResidentIds = guardian.residentIds.filter(id => id !== args.residentId);
        await ctx.db.patch(guardian._id, { residentIds: updatedResidentIds });
      }
    }

    // 10. Delete profile image if exists
    if (resident.profileImageId) {
      await ctx.storage.delete(resident.profileImageId);
    }

    // 11. Finally, delete the resident record
    await ctx.db.delete(args.residentId);

    await audit(ctx, "delete_resident", userId, `residentId=${args.residentId},name=${resident.name}`);
    return { success: true };
  },
});

// Generate upload URL for fire evac plan
export const generateFireEvacUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const userRole = await getUserRoleDoc(ctx, userId);
    if (!userRole || !["admin", "supervisor"].includes(userRole.role)) {
      throw new Error("Only admins and supervisors can upload fire evacuation plans");
    }
    
    return await ctx.storage.generateUploadUrl();
  },
});
