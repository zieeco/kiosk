# Ezer - Administrator Setup Guide

## Initial Administrator Setup with Clerk

When you first deploy Ezer to a new environment, you'll need to set up the initial administrator account and configure Clerk. This guide explains the process.

---

## Administrator Setup

### Overview

The application exclusively uses Clerk for user authentication. The first administrator will be created directly through Clerk's sign-up flow, and all subsequent employee accounts will be managed by the administrator within the application.

### Steps

1.  **Access the Application**
    *   Open your browser and navigate to your Ezer deployment URL.
    *   Example: `https://fleet-bobcat-14.convex.app`

2.  **Sign Up as First Administrator**
    *   You will be redirected to Clerk's sign-up page.
    *   Follow the prompts to create your administrator account using your email address and a strong password.
    *   Complete any verification steps required by Clerk (e.g., email verification).

3.  **Complete Admin Profile (if prompted)**
    *   After signing up with Clerk, you might be redirected to an application-specific page to complete your admin profile (e.g., entering your full name, if not captured by Clerk).

4.  **Sign In**
    *   Once your admin account is created and verified, use your Clerk credentials to sign in.
    *   You now have full administrator access.

### Security Notes

*   ✅ Clerk handles all user authentication securely, including password hashing and multi-factor authentication options.
*   ✅ All subsequent employees will be invited and managed by an existing administrator through the Admin Portal.
*   ✅ Employee logins are restricted to company-assigned kiosk devices. Unauthorized device access will be blocked.


## After Initial Setup

Once the first administrator is created and Clerk is configured:

### 1. Sign In
*   Use your Clerk credentials to sign in.
*   You'll be directed to the Admin Portal.

### 2. Configure Locations
*   Go to **Settings → Locations**.
*   Add your care facility locations.
*   Example: "Main Building", "West Wing", etc.

### 3. Invite Staff
*   Go to **Employees** workspace.
*   Click "Invite Employee".
*   Enter employee details:
    *   Name
    *   Work email
    *   Role (Admin, Supervisor, or Staff)
    *   Assigned locations
    *   Set a temporary password for the employee.
*   The employee will receive an email notification with their login credentials (email and temporary password) and instructions.
*   **Important**: Employees can *only* log in from company-assigned kiosk devices. Any attempt to log in from an unauthorized device (e.g., personal phone, laptop) will be blocked immediately. Upon successful login from an assigned device, they will be redirected to their employee dashboard.

### 4. Set Up Residents
*   Go to **Residents** workspace.
*   Add resident profiles.
*   Upload ISP documents.
*   Configure fire evacuation plans.

### 5. Configure Kiosks (Mandatory for Employee Login)
*   Go to **Settings → Kiosk Management**.
*   Register and assign physical kiosk devices to specific locations.
*   Ensure each employee's assigned device is properly configured and authorized in the system. Employees will only be able to log in from these registered devices.

---

## Troubleshooting

### "Admin already exists" Error

**Problem**: You encounter an error indicating the admin account already exists during Clerk sign-up.

**Solution**: An administrator account with that email already exists in Clerk. Please use the sign-in form instead, or try a different email address for a new admin.

### Forgot Admin Password

**Problem**: Lost access to your admin account.

**Solution**:
1.  Use Clerk's "Forgot Password" flow on the sign-in page to reset your password.
2.  If you encounter persistent issues, contact your technical team for assistance with Clerk user management.

### Unauthorized Device Access

**Problem**: An employee is unable to log in from a device.

**Solution**:
1.  Verify that the device is a company-assigned kiosk and has been properly registered and authorized in **Settings → Kiosk Management**.
2.  Ensure the employee is attempting to log in from the *assigned* device.
3.  Check the device's network connection.

---

## Security Best Practices

### Password Requirements
*   ✅ Clerk enforces strong password policies. Adhere to Clerk's recommendations for minimum length, complexity, and rotation.
*   ✅ Encourage the use of password managers.

### Account Security
*   🔒 Clerk handles secure storage and management of user credentials.
*   🔒 Never share admin or employee credentials.
*   🔒 Employee accounts are strictly tied to company-assigned kiosk devices. Unauthorized device access is automatically blocked.
*   🔒 Regularly review user access and device authorizations in the Admin Portal.
*   🔒 Immediately revoke access for terminated employees and de-authorize their assigned devices.

### Audit Trail
- All admin actions are logged in `audit_logs` table
- Review logs regularly for suspicious activity
- Logs include: user, timestamp, action, and details

---

## Support

For technical support or questions:
- **Developer**: Bold Ideas Innovations Ltd.
- **Documentation**: See USER_GUIDE_ADMIN.md for full admin features
- **Convex Dashboard**: https://dashboard.convex.dev

---

## Quick Reference

| Task | Location |
|------|----------|
| Create first admin | Clerk Sign-up Page |
| Sign in | Clerk Sign-in Page |
| Invite employees | Admin Portal → Employees (Clerk-managed) |
| Add residents | Admin Portal → Residents |
| Configure locations | Admin Portal → Settings → Locations |
| Set up kiosks | Admin Portal → Settings → Kiosk Management (Mandatory for employee login) |
| View audit logs | Admin Portal → Settings → System |

---

**Last Updated**: January 2025  
**Version**: 1.0
