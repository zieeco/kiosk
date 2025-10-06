"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";


// Send password reset email
export const sendPasswordResetEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Call mutation to generate token and get user info
    const { api } = await import("./_generated/api");
    const result = await ctx.runMutation(api.passwordReset.generatePasswordResetToken, {
      email: args.email,
    });

    if (!result) {
      // Do not send an email if the user does not exist (prevents enumeration)
      return { success: true };
    }

    const { email, token, userName } = result;

    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Use dynamic base URL from environment or fallback
    const baseUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL || "https://fleet-bobcat-14.convex.app";
    const resetUrl = `${baseUrl}/reset-password?email=${encodeURIComponent(email)}&code=${token}`;

    const subject = "Reset Your Password";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${userName || "there"},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            Reset Password
          </a>
        </div>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">
          Powered by <strong>Bold Ideas Innovations Ltd.</strong>
        </p>
      </div>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: "El-Elyon Properties <noreply@myezer.org>",
        to: email,
        subject,
        html,
      });

      if (error) {
        console.error("Resend API error:", error);
        throw new Error("Failed to send reset email: " + JSON.stringify(error));
      }

      console.log("Password reset email sent successfully:", data);
      return { success: true };
    } catch (err) {
      console.error("Error sending password reset email:", err);
      throw new Error("Failed to send reset email. Please try again.");
    }
  },
});
