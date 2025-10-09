import { internalAction } from "./_generated/server";
import { v } from "convex/values";
// import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// --- SEND WELCOME EMAIL ACTION (internal) ---
export const sendWelcomeEmail = internalAction({
  args: {
    employeeId: v.id("employees"),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("Starting welcome email send for employee:", args.employeeId, "email:", args.email);

    try {
      const { Resend } = await import("resend");

      // Get employee details (name, role, locations)
      const employee = await ctx.runQuery(internal.employees.getEmployeeForEmail, {
        employeeId: args.employeeId,
      });

      if (!employee || !employee.email) {
        console.error("Employee data missing for welcome email:", employee);
        throw new Error("Employee not found or email missing");
      }

      console.log("Sending welcome email to:", employee.email);

      const apiKey = process.env.RESEND_API_KEY || process.env.CONVEX_RESEND_API_KEY;
      if (!apiKey) {
        console.error("No Resend API key available for welcome email");
        throw new Error("No email service configured");
      }

      const resend = new Resend(apiKey);

      const loginUrl = process.env.SITE_URL || process.env.CONVEX_SITE_URL || 'http://localhost:5173';

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #218838 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Your Ezer Account is Ready!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #333; margin-top: 0;">Hi ${employee.name},</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Your account for the Ezer care management system has been created.
              You are assigned as a <strong>${employee.role}</strong>.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #333; margin-top: 0;">Your Login Credentials:</h3>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${args.email}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code>${args.password}</code></p>
              <p style="margin: 5px 0;"><strong>Assigned Locations:</strong> ${employee.locations.length > 0 ? employee.locations.join(', ') : 'None assigned yet'}</p>
            </div>

            <div style="background: #ffe0b2; border: 1px solid #ffcc80; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; color: #e65100; font-size: 14px;">
                <strong>🔒 Security Notice:</strong> For your security, you can only log in from company-assigned kiosk devices. Attempts to log in from unauthorized devices will be blocked.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Go to Login Page
              </a>
            </div>
            
            <h3 style="color: #333;">What's Next?</h3>
            <ol style="color: #555; line-height: 1.6;">
              <li>Go to a company-assigned kiosk device.</li>
              <li>Navigate to the login page using the button above.</li>
              <li>Log in with your email and the temporary password provided.</li>
              <li>You will be prompted to set a new, secure password upon first login.</li>
            </ol>
            
            <p style="color: #555; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              If you have any questions or need help, please contact your supervisor or system administrator.
            </p>
            
            <p style="color: #888; font-size: 12px; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${loginUrl}" style="color: #28a745; word-break: break-all;">${loginUrl}</a>
            </p>
          </div>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || "Ezer Support <noreply@ezer.example.com>",
        to: args.email,
        subject: `Your Ezer Account Credentials - Welcome to the Team!`,
        html: emailHtml,
      });

      console.log("Resend API response for welcome email:", { data, error });

      if (error) {
        console.error('Failed to send welcome email:', error);
        if (error.message && error.message.includes('domain')) {
          throw new Error(`Welcome email sending failed: The email address ${employee.email} may not be verified for sending. In the Chef environment, emails can only be sent to verified addresses.`);
        }
        throw new Error('Failed to send welcome email: ' + JSON.stringify(error));
      }

      console.log('Welcome email sent successfully:', data);
      return { success: true, emailId: data?.id };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  },
});
