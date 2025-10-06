import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import bcrypt from "bcryptjs";

// Helper to generate a random token
function generateToken(length = 32) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Helper: Get user role doc
async function getUserRoleDoc(ctx: { db: any }, userId: Id<"users">) {
  return await ctx.db
    .query("roles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();
}

// Helper: Audit
async function audit(ctx: { db: any }, event: string, userId: Id<"users"> | null, details?: string) {
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
async function requireAdmin(ctx: { db: any }, userId: Id<"users">) {
  const userRole = await getUserRoleDoc(ctx, userId);
  if (!userRole || userRole.role !== "admin") {
    await audit(ctx, "access_denied", userId, "admin_required");
    throw new Error("Admin access required");
  }
  return userRole;
}

// --- RECOMMENDED: CREATE EMPLOYEE WITH INVITE LINK ---
// This is the most reliable method - employee sets their own password
export const createEmployeeWithInvite = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
    locations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if employee already exists
    const existingEmployee = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (existingEmployee) {
      throw new Error("Employee with this email already exists");
    }

    // Check if user account already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (existingUser) {
      throw new Error("User account with this email already exists");
    }

    // Generate invite token (valid for 7 days)
    const inviteToken = generateToken(32);
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    // Create employee record with pending status
    const employeeId = await ctx.db.insert("employees", {
      name: args.name,
      email: normalizedEmail,
      workEmail: normalizedEmail,
      role: args.role,
      locations: args.locations,
      hasAcceptedInvite: false,
      inviteToken,
      inviteExpiresAt: expiresAt,
      employmentStatus: "pending",
      invitedAt: Date.now(),
      invitedBy: userId,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await audit(ctx, "create_employee_invite", userId, `employeeId=${employeeId},email=${normalizedEmail}`);
    
    // Send invite email
    await ctx.scheduler.runAfter(0, internal.employeesImproved.sendInviteEmail, {
      employeeId,
      email: normalizedEmail,
      name: args.name,
      inviteToken,
    });
    
    return { 
      success: true, 
      employeeId,
      message: "Invite email sent to " + normalizedEmail,
    };
  },
});

// --- ALTERNATIVE: CREATE EMPLOYEE WITH TEMPORARY PASSWORD ---
// Use this only if email is not available - less secure
export const createEmployeeWithPassword = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    temporaryPassword: v.string(),
    role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
    locations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    const normalizedEmail = args.email.toLowerCase().trim();

    // Validate password
    if (args.temporaryPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    // Check if employee already exists
    const existingEmployee = await ctx.db
      .query("employees")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (existingEmployee) {
      throw new Error("Employee with this email already exists");
    }

    // Check if user account already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();
    
    if (existingUser) {
      throw new Error("User account with this email already exists");
    }

    // Hash password with bcrypt (same as bootstrap admin)
    const hashedPassword = bcrypt.hashSync(args.temporaryPassword, 10);

    // Create user account
    const newUserId = await ctx.db.insert("users", {
      email: normalizedEmail,
      name: args.name,
      emailVerificationTime: Date.now(),
    });
    
    // Create auth account with password
    await ctx.db.insert("authAccounts", {
      userId: newUserId,
      provider: "password",
      providerAccountId: normalizedEmail,
      secret: hashedPassword,
    });
    
    // Create role record
    await ctx.db.insert("roles", {
      userId: newUserId,
      role: args.role,
      locations: args.locations,
      assignedBy: userId,
      assignedAt: Date.now(),
    });

    // Create employee record
    const employeeId = await ctx.db.insert("employees", {
      name: args.name,
      email: normalizedEmail,
      workEmail: normalizedEmail,
      role: args.role,
      locations: args.locations,
      hasAcceptedInvite: true,
      employmentStatus: "active",
      invitedAt: Date.now(),
      onboardedAt: Date.now(),
      onboardedBy: userId,
      createdAt: Date.now(),
      createdBy: userId,
    });

    await audit(ctx, "create_employee_with_password", userId, `employeeId=${employeeId},userId=${newUserId},email=${normalizedEmail}`);
    
    return { 
      success: true, 
      employeeId,
      userId: newUserId,
      email: normalizedEmail,
      temporaryPassword: args.temporaryPassword,
      message: "Employee created. Share these credentials securely.",
    };
  },
});

// --- ACCEPT INVITE AND SET PASSWORD ---
export const acceptInviteAndSetPassword = mutation({
  args: {
    inviteToken: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find employee by invite token
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.inviteToken))
      .first();

    if (!employee) {
      throw new Error("Invalid invite token");
    }

    if (employee.hasAcceptedInvite) {
      throw new Error("Invite already accepted");
    }

    if (employee.inviteExpiresAt && employee.inviteExpiresAt < Date.now()) {
      throw new Error("Invite has expired");
    }

    // Validate password
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const normalizedEmail = employee.email || employee.workEmail;
    if (!normalizedEmail) {
      throw new Error("Employee email not found");
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(args.password, 10);

    // Create user account
    const newUserId = await ctx.db.insert("users", {
      email: normalizedEmail,
      name: employee.name,
      emailVerificationTime: Date.now(),
    });
    
    // Create auth account
    await ctx.db.insert("authAccounts", {
      userId: newUserId,
      provider: "password",
      providerAccountId: normalizedEmail,
      secret: hashedPassword,
    });
    
    // Create role record
    await ctx.db.insert("roles", {
      userId: newUserId,
      role: employee.role || "staff",
      locations: employee.locations || [],
      assignedAt: Date.now(),
    });

    // Update employee record
    await ctx.db.patch(employee._id, {
      hasAcceptedInvite: true,
      employmentStatus: "active",
      onboardedAt: Date.now(),
    });

    await audit(ctx, "accept_employee_invite", newUserId, `employeeId=${employee._id},email=${normalizedEmail}`);
    
    return { 
      success: true,
      message: "Account created successfully. You can now sign in.",
    };
  },
});

// --- VERIFY INVITE TOKEN ---
export const verifyInviteToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .first();

    if (!employee) {
      return { valid: false, message: "Invalid invite token" };
    }

    if (employee.hasAcceptedInvite) {
      return { valid: false, message: "Invite already accepted" };
    }

    if (employee.inviteExpiresAt && employee.inviteExpiresAt < Date.now()) {
      return { valid: false, message: "Invite has expired" };
    }

    return {
      valid: true,
      employeeName: employee.name,
      employeeEmail: employee.email || employee.workEmail,
      role: employee.role,
    };
  },
});

// --- SEND INVITE EMAIL (Internal Action) ---
export const sendInviteEmail = internalAction({
  args: {
    employeeId: v.id("employees"),
    email: v.string(),
    name: v.string(),
    inviteToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.CONVEX_RESEND_API_KEY || process.env.RESEND_API_KEY);
    
    // Get base URL from environment or use dynamic fallback
    const baseUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL || "https://fleet-bobcat-14.convex.cloud";
    const inviteUrl = `${baseUrl}/?employee_invite=${args.inviteToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to El-Elyon Properties!</h2>
        <p>Hello ${args.name},</p>
        <p>You've been invited to join the El-Elyon Properties care management system.</p>
        <p>Click the button below to accept your invite and set your password:</p>
        <div style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            Accept Invite & Set Password
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p style="color: #666; word-break: break-all;">${inviteUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 14px;">
          This invite will expire in 7 days. If you didn't expect this invitation, please ignore this email.
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Powered by <strong>Bold Ideas Innovations Ltd.</strong>
        </p>
      </div>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: "El-Elyon Properties <noreply@myezer.org>",
        to: args.email,
        subject: "Welcome to El-Elyon Properties - Set Your Password",
        html,
      });

      if (error) {
        console.error("Failed to send invite email:", error);
        throw new Error("Failed to send invite email");
      }

      console.log("Invite email sent successfully:", data);
      return { success: true };
    } catch (err) {
      console.error("Error sending invite email:", err);
      throw err;
    }
  },
});

// --- RESEND INVITE ---
export const resendInvite = mutation({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    const employee = await ctx.db.get(args.employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.hasAcceptedInvite) {
      throw new Error("Employee has already accepted the invite");
    }

    // Generate new token and extend expiration
    const newToken = generateToken(32);
    const newExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

    await ctx.db.patch(args.employeeId, {
      inviteToken: newToken,
      inviteExpiresAt: newExpiresAt,
      inviteResent: Date.now(),
    });

    // Send new invite email
    await ctx.scheduler.runAfter(0, internal.employeesImproved.sendInviteEmail, {
      employeeId: args.employeeId,
      email: employee.email || employee.workEmail || "",
      name: employee.name,
      inviteToken: newToken,
    });

    await audit(ctx, "resend_employee_invite", userId, `employeeId=${args.employeeId}`);

    return { success: true, message: "Invite resent successfully" };
  },
});
