import { mutation } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

// Generate a secure random token
function generateResetToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Generate token and user info for password reset email
export const generatePasswordResetToken = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      return null;
    }

    const token = generateResetToken();
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour

    await ctx.db.insert("password_reset_tokens", {
      userId: user._id,
      token,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });

    return {
      email: normalizedEmail,
      token,
      userName: user.name,
    };
  },
});

// Reset password using token
export const resetPassword = mutation({
  args: {
    email: v.string(),
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Find the reset token
    const resetToken = await ctx.db
      .query("password_reset_tokens")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("token"), args.token),
          q.eq(q.field("used"), false)
        )
      )
      .first();

    if (!resetToken) {
      throw new Error("Invalid or expired reset token");
    }

    // Check if token is expired
    if (resetToken.expiresAt < Date.now()) {
      throw new Error("Reset token has expired");
    }

    // Validate new password
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Hash the new password
    const hashedPassword = bcrypt.hashSync(args.newPassword, 10);

    // Update the user's password in authAccounts
    const authAccount = await ctx.db
      .query("authAccounts")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("provider"), "password")
        )
      )
      .first();

    if (!authAccount) {
      throw new Error("No password account found for user");
    }

    // Update the password
    await ctx.db.patch(authAccount._id, {
      secret: hashedPassword,
    });

    // Mark the reset token as used
    await ctx.db.patch(resetToken._id, {
      used: true,
      usedAt: Date.now(),
    });

    // Add audit log
    await ctx.db.insert("audit_logs", {
      userId: user._id,
      event: "password_reset",
      timestamp: Date.now(),
      deviceId: "web",
      location: "",
      details: `Password reset completed for ${normalizedEmail}`,
    });

    return { success: true };
  },
});

// Verify reset token (for checking if token is valid before showing reset form)
export const verifyResetToken = mutation({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();

    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!user) {
      return { valid: false, message: "User not found" };
    }

    // Find the reset token
    const resetToken = await ctx.db
      .query("password_reset_tokens")
      .filter((q) => 
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("token"), args.token),
          q.eq(q.field("used"), false)
        )
      )
      .first();

    if (!resetToken) {
      return { valid: false, message: "Invalid reset token" };
    }

    // Check if token is expired
    if (resetToken.expiresAt < Date.now()) {
      return { valid: false, message: "Reset token has expired" };
    }

    return { 
      valid: true, 
      userName: user.name,
      email: normalizedEmail 
    };
  },
});
