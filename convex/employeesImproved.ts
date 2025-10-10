// import { mutation, query, internalMutation, internalAction, action } from "./_generated/server";
// import { v } from "convex/values";
// import { internal } from "./_generated/api";
// import { Id } from "./_generated/dataModel";
// import bcrypt from "bcryptjs";

// // Helper to generate a random token
// function generateToken(length = 32) {
//   const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
//   let token = "";
//   for (let i = 0; i < length; i++) {
//     token += chars.charAt(Math.floor(Math.random() * chars.length));
//   }
//   return token;
// }

// // Helper: Get user role doc
// async function getUserRoleDoc(ctx: { db: any }, clerkUserId: string) {
//   return await ctx.db
//     .query("roles")
//     .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
//     .unique();
// }

// // Helper: Audit
// async function audit(ctx: any, event: string, clerkUserId: string | null, details?: string) {
//   await ctx.db.insert("audit_logs", {
//     clerkUserId: clerkUserId ?? undefined,
//     event,
//     timestamp: Date.now(),
//     deviceId: "system",
//     location: "",
//     details,
//   });
// }

// // Helper: Check admin access
// async function requireAdmin(ctx: { db: any }, clerkUserId: string) {
//   const userRole = await getUserRoleDoc(ctx, clerkUserId);
//   if (!userRole || userRole.role !== "admin") {
//     await audit(ctx, "access_denied", clerkUserId, "admin_required");
//     throw new Error("Admin access required");
//   }
//   return userRole;
// }

// // --- RECOMMENDED: CREATE EMPLOYEE WITH INVITE LINK ---
// // This is the most reliable method - employee sets their own password
// export const createEmployeeWithInvite = mutation({
//   args: {
//     name: v.string(),
//     email: v.string(),
//     role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
//     locations: v.array(v.string()),
//   },
//   handler: async (ctx, args) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) throw new Error("Not authenticated");
//     const clerkUserId = identity.subject;
//     await requireAdmin(ctx, clerkUserId);

//     const normalizedEmail = args.email.toLowerCase().trim();

//     // Check if employee already exists
//     const existingEmployee = await ctx.db
//       .query("employees")
//       .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
//       .first();
    
//     if (existingEmployee) {
//       throw new Error("Employee with this email already exists");
//     }

//     // Generate invite token (valid for 7 days)
//     const inviteToken = generateToken(32);
//     const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

//     // Create employee record with pending status
//     const employeeId = await ctx.db.insert("employees", {
//       name: args.name,
//       email: normalizedEmail,
//       workEmail: normalizedEmail,
//       hasAcceptedInvite: false,
//       inviteToken,
//       inviteExpiresAt: expiresAt,
//       employmentStatus: "pending",
//       invitedAt: Date.now(),
//       invitedBy: clerkUserId,
//       createdAt: Date.now(),
//       createdBy: clerkUserId,
//       locations: args.locations,
//     });

//     // Create a role record for the employee with a temporary clerkUserId (employeeId)
//     await ctx.db.insert("roles", {
//       clerkUserId: employeeId, // Temporary clerkUserId until invite is accepted
//       role: args.role,
//       locations: args.locations,
//       assignedBy: clerkUserId,
//       assignedAt: Date.now(),
//     });

//     await audit(ctx, "create_employee_invite", clerkUserId, `employeeId=${employeeId},email=${normalizedEmail}`);
    
//     // Send invite email
//     await ctx.scheduler.runAfter(0, internal.employeesImproved.sendInviteEmail, {
//       employeeId,
//       email: normalizedEmail,
//       name: args.name,
//       inviteToken,
//     });
    
//     return { 
//       success: true, 
//       employeeId,
//       message: "Invite email sent to " + normalizedEmail,
//     };
//   },
// });

// // --- ALTERNATIVE: CREATE EMPLOYEE WITH TEMPORARY PASSWORD (Mutation calls Action) ---
// export const createEmployeeWithPassword = mutation({
//   args: {
//     name: v.string(),
//     email: v.string(),
//     temporaryPassword: v.string(),
//     role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
//     locations: v.array(v.string()),
//   },
//   handler: async (ctx, args): Promise<{ success: boolean; employeeId: Id<"employees">; clerkUserId: string; email: string; temporaryPassword: string; message: string }> => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) throw new Error("Not authenticated");
//     const clerkUserId = identity.subject;
//     await requireAdmin(ctx, clerkUserId);

//     const normalizedEmail = args.email.toLowerCase().trim();

//     // Validate password
//     if (args.temporaryPassword.length < 8) {
//       throw new Error("Password must be at least 8 characters");
//     }

//     // Check if employee already exists
//     const existingEmployee = await ctx.db
//       .query("employees")
//       .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
//       .first();
    
//     if (existingEmployee) {
//       throw new Error("Employee with this email already exists");
//     }

//     // Call internal action to handle user creation and password hashing
//     const { employeeId, clerkUserId: createdClerkUserId } = await (ctx as any).runAction(internal.employeesImproved.insertEmployeeMutation, {
//       name: args.name,
//       email: normalizedEmail,
//       temporaryPassword: args.temporaryPassword,
//       role: args.role,
//       locations: args.locations,
//       adminClerkUserId: clerkUserId, // Pass the admin's clerkUserId for auditing
//     });

//     await audit(ctx, "create_employee_with_password", clerkUserId, `employeeId=${employeeId},clerkUserId=${createdClerkUserId},email=${normalizedEmail}`);
    
//     return { 
//       success: true, 
//       employeeId: employeeId,
//       clerkUserId: createdClerkUserId,
//       email: normalizedEmail,
//       temporaryPassword: args.temporaryPassword,
//       message: "Employee created. Share these credentials securely.",
//     };
//   },
// });

// // INTERNAL ACTION: Handles creation of employee with temporary password (uses bcrypt)
// export const createEmployeeWithPasswordInternal = action({
//   args: {
//     name: v.string(),
//     email: v.string(),
//     temporaryPassword: v.string(),
//     role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
//     locations: v.array(v.string()),
//     adminClerkUserId: v.string(), // ClerkUserId of the admin performing the action
//   },
//   handler: async (ctx, args) => {
//     "use node"; // Required for bcrypt

//     // Hash password
//     const hashedPassword = bcrypt.hashSync(args.temporaryPassword, 10);

//     // Create auth account with password
//     await ctx.runMutation(internal.employeesImproved.insertAuthAccountMutation, {
//       clerkUserId: args.email,
//       provider: "password",
//       providerAccountId: args.email,
//       secret: hashedPassword,
//     });
    
//     // Create role record
//     await ctx.runMutation(internal.employeesImproved.insertRoleMutation, {
//       clerkUserId: args.email,
//       role: args.role,
//       locations: args.locations,
//       assignedBy: args.adminClerkUserId,
//       assignedAt: Date.now(),
//     });

//     // Create employee record
//     const employeeId: any = await ctx.runMutation(internal.employeesImproved.insertEmployeeMutation, {
//       name: args.name,
//       email: args.email,
//       workEmail: args.email,
//       hasAcceptedInvite: true,
//       employmentStatus: "active",
//       invitedAt: Date.now(),
//       onboardedAt: Date.now(),
//       onboardedBy: args.adminClerkUserId,
//       createdAt: Date.now(),
//       createdBy: args.adminClerkUserId,
//       clerkUserId: args.email,
//     });

//     return { 
//       employeeId,
//       clerkUserId: args.email,
//     };
//   },
// });

// // --- ACCEPT INVITE AND SET PASSWORD (Mutation calls Action) ---
// export const acceptInviteAndSetPassword = mutation({
//   args: {
//     inviteToken: v.string(),
//     password: v.string(),
//   },
//   handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
//     // Find employee by invite token
//     const employee = await ctx.db
//       .query("employees")
//       .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.inviteToken))
//       .first();

//     if (!employee) {
//       throw new Error("Invalid invite token");
//     }

//     if (employee.hasAcceptedInvite) {
//       throw new Error("Invite already accepted");
//     }

//     if (employee.inviteExpiresAt && employee.inviteExpiresAt < Date.now()) {
//       throw new Error("Invite has expired");
//     }

//     // Validate password
//     if (args.password.length < 8) {
//       throw new Error("Password must be at least 8 characters");
//     }

//     const normalizedEmail = employee.email || employee.workEmail;
//     if (!normalizedEmail) {
//       throw new Error("Employee email not found");
//     }

//     // Fetch the role associated with the employee's temporary clerkUserId (employee._id)
//     const employeeRole = await ctx.db
//       .query("roles")
//       .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", employee._id))
//       .first();

//     if (!employeeRole) {
//       throw new Error("Employee role not found");
//     }

//     // Call internal action to handle password hashing and user/role creation
//     const {clerkUserId: acceptedClerkUserId} = await (ctx as any).runAction(
// 			internal.employeesImproved.sendInviteEmail,
// 			{
// 				employeeId: employee._id,
// 				email: normalizedEmail,
// 				name: employee.name,
// 				password: args.password,
// 				role: employeeRole.role,
// 				locations: employeeRole.locations,
// 			}
// 		);

//     await audit(ctx, "accept_employee_invite", acceptedClerkUserId, `employeeId=${employee._id},email=${normalizedEmail}`);
    
//     return { 
//       success: true,
//       message: "Account created successfully. You can now sign in.",
//     };
//   },
// });

// // INTERNAL ACTION: Handles password hashing and user/role creation for invite acceptance
// export const acceptInviteAndSetPasswordInternal = action({
//   args: {
//     employeeId: v.id("employees"),
//     email: v.string(),
//     name: v.string(),
//     password: v.string(),
//     role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
//     locations: v.array(v.string()),
//   },
//   handler: async (ctx, args) => {
//     "use node"; // Required for bcrypt

//     // Hash password
//     const hashedPassword = bcrypt.hashSync(args.password, 10);

//     // Create auth account
//     await ctx.runMutation(internal.employeesImproved.insertAuthAccountMutation, {
//       clerkUserId: args.email,
//       provider: "password",
//       providerAccountId: args.email,
//       secret: hashedPassword,
//     });
    
//     // Create role record
//     await ctx.runMutation(internal.employeesImproved.insertRoleMutation, {
//       clerkUserId: args.email,
//       role: args.role,
//       locations: args.locations,
//       assignedAt: Date.now(),
//     });

//     // Update employee record
//     await ctx.runMutation(internal.employeesImproved.patchEmployeeMutation, {
//       employeeId: args.employeeId,
//       hasAcceptedInvite: true,
//       employmentStatus: "active",
//       onboardedAt: Date.now(),
//       clerkUserId: args.email,
//     });

//     return { clerkUserId: args.email };
//   },
// });

// // --- VERIFY INVITE TOKEN ---
// export const verifyInviteToken = query({
//   args: { token: v.string() },
//   handler: async (ctx, args) => {
//     const employee = await ctx.db
//       .query("employees")
//       .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
//       .first();

//     if (!employee) {
//       return { valid: false, message: "Invalid invite token" };
//     }

//     if (employee.hasAcceptedInvite) {
//       return { valid: false, message: "Invite already accepted" };
//     }

//     if (employee.inviteExpiresAt && employee.inviteExpiresAt < Date.now()) {
//       return { valid: false, message: "Invite has expired" };
//     }

//     const employeeRole = await ctx.db
//       .query("roles")
//       .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", employee._id)) // Use employee._id as temporary clerkUserId
//       .first();

//     return {
//       valid: true,
//       employeeName: employee.name,
//       employeeEmail: employee.email || employee.workEmail,
//       role: employeeRole?.role || null,
//     };
//   },
// });

// // --- SEND INVITE EMAIL (Internal Action) ---
// export const sendInviteEmail = internalAction({
//   args: {
//     employeeId: v.id("employees"),
//     email: v.string(),
//     name: v.string(),
//     inviteToken: v.string(),
//   },
//   handler: async (ctx, args) => {
//     "use node"; // Required for Resend
//     const { Resend } = await import("resend");
//     const resend = new Resend(process.env.CONVEX_RESEND_API_KEY || process.env.RESEND_API_KEY);
    
//     // Get base URL from environment or use dynamic fallback
//     const baseUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL || "https://fleet-bobcat-14.convex.cloud";
//     const inviteUrl = `${baseUrl}/?employee_invite=${args.inviteToken}`;

//     const html = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//         <h2>Welcome to El-Elyon Properties!</h2>
//         <p>Hello ${args.name},</p>
//         <p>You've been invited to join the El-Elyon Properties care management system.</p>
//         <p>Click the button below to accept your invite and set your password:</p>
//         <div style="margin: 30px 0;">
//           <a href="${inviteUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
//             Accept Invite & Set Password
//           </a>
//         </div>
//         <p>If the button doesn't work, copy and paste this link:</p>
//         <p style="color: #666; word-break: break-all;">${inviteUrl}</p>
//         <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
//         <p style="color: #666; font-size: 14px;">
//           This invite will expire in 7 days. If you didn't expect this invitation, please ignore this email.
//         </p>
//         <p style="color: #666; font-size: 12px; margin-top: 20px;">
//           Powered by <strong>Bold Ideas Innovations Ltd.</strong>
//         </p>
//       </div>
//     `;

//     try {
//       const { data, error } = await resend.emails.send({
//         from: "El-Elyon Properties <noreply@myezer.org>",
//         to: args.email,
//         subject: "Welcome to El-Elyon Properties - Set Your Password",
//         html,
//       });

//       if (error) {
//         console.error("Failed to send invite email:", error);
//         throw new Error("Failed to send invite email");
//       }

//       console.log("Invite email sent successfully:", data);
//       return { success: true };
//     } catch (err) {
//       console.error("Error sending invite email:", err);
//       throw err;
//     }
//   },
// });

// // --- RESEND INVITE ---
// export const resendInvite = mutation({
//   args: { employeeId: v.id("employees") },
//   handler: async (ctx, args) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) throw new Error("Not authenticated");
//     const clerkUserId = identity.subject;
//     await requireAdmin(ctx, clerkUserId);

//     const employee = await ctx.db.get(args.employeeId);
//     if (!employee) {
//       throw new Error("Employee not found");
//     }

//     if (employee.hasAcceptedInvite) {
//       throw new Error("Employee has already accepted the invite");
//     }

//     // Generate new token and extend expiration
//     const newToken = generateToken(32);
//     const newExpiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);

//     await ctx.db.patch(args.employeeId, {
//       inviteToken: newToken,
//       inviteExpiresAt: newExpiresAt,
//       inviteResent: Date.now(),
//     });

//     // Send new invite email
//     await ctx.scheduler.runAfter(0, internal.employeesImproved.sendInviteEmail, {
//       employeeId: args.employeeId,
//       email: employee.email || employee.workEmail || "",
//       name: employee.name,
//       inviteToken: newToken,
//     });

//     await audit(ctx, "resend_employee_invite", clerkUserId, `employeeId=${args.employeeId}`);

//     return { success: true, message: "Invite resent successfully" };
//   },
// });

// export const insertAuthAccountMutation = internalMutation({
//   args: {
//     clerkUserId: v.string(),
//     provider: v.string(),
//     providerAccountId: v.string(),
//     secret: v.string(),
//   },
//   returns: v.id("authAccounts"),
//   handler: async (ctx, args) => {
//     return await ctx.db.insert("authAccounts", {
//       clerkUserId: args.clerkUserId,
//       provider: args.provider,
//       providerAccountId: args.providerAccountId,
//       secret: args.secret,
//     });
//   },
// });

// export const insertRoleMutation = internalMutation({
//   args: {
//     clerkUserId: v.string(),
//     role: v.union(v.literal("admin"), v.literal("supervisor"), v.literal("staff")),
//     locations: v.array(v.string()),
//     assignedBy: v.optional(v.string()),
//     assignedAt: v.number(),
//   },
//   returns: v.id("roles"),
//   handler: async (ctx, args) => {
//     return await ctx.db.insert("roles", {
//       clerkUserId: args.clerkUserId,
//       role: args.role,
//       locations: args.locations,
//       assignedBy: args.assignedBy,
//       assignedAt: args.assignedAt,
//     });
//   },
// });

// export const insertEmployeeMutation = internalMutation({
//   args: {
//     name: v.string(),
//     email: v.string(),
//     workEmail: v.string(),
//     hasAcceptedInvite: v.boolean(),
//     employmentStatus: v.string(),
//     invitedAt: v.number(),
//     onboardedAt: v.optional(v.number()),
//     onboardedBy: v.optional(v.string()),
//     createdAt: v.number(),
//     createdBy: v.string(),
//     clerkUserId: v.string(),
//   },
//   returns: v.id("employees"),
//   handler: async (ctx, args) => {
//     return await ctx.db.insert("employees", {
//       name: args.name,
//       email: args.email,
//       workEmail: args.workEmail,
//       hasAcceptedInvite: args.hasAcceptedInvite,
//       employmentStatus: args.employmentStatus,
//       invitedAt: args.invitedAt,
//       onboardedAt: args.onboardedAt,
//       onboardedBy: args.onboardedBy,
//       createdAt: args.createdAt,
//       createdBy: args.createdBy,
//       clerkUserId: args.clerkUserId,
//       locations: [],
//     });
//   },
// });

// export const patchEmployeeMutation = internalMutation({
//   args: {
//     employeeId: v.id("employees"),
//     hasAcceptedInvite: v.boolean(),
//     employmentStatus: v.string(),
//     onboardedAt: v.number(),
//     clerkUserId: v.string(),
//   },
//   returns: v.null(),
//   handler: async (ctx, args) => {
//     await ctx.db.patch(args.employeeId, {
//       hasAcceptedInvite: args.hasAcceptedInvite,
//       employmentStatus: args.employmentStatus,
//       onboardedAt: args.onboardedAt,
//       clerkUserId: args.clerkUserId,
//     });
//     return null;
//   },
// });
