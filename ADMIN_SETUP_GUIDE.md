# Ezer - Administrator Setup Guide

## Initial Setup for Client Handover

When you first deploy Ezer to a new environment, you'll need to create the first administrator account. This guide explains the process.

---

## Method 1: Automatic Bootstrap Screen (Recommended)

### What Happens

When you first access the application and **no administrator exists**, you'll automatically see a "Create First Admin" screen.

### Steps

1. **Access the Application**
   - Open your browser and navigate to your Ezer deployment URL
   - Example: `https://fleet-bobcat-14.convex.app`

2. **Fill in Admin Details**
   - **Full Name**: Enter the administrator's full name
   - **Email Address**: Enter a valid email address (this will be the login username)
   - **Password**: Create a strong password (minimum 8 characters)
   - **Confirm Password**: Re-enter the password

3. **Create Account**
   - Click "Create Admin Account"
   - Wait for confirmation message
   - The page will automatically reload

4. **Sign In**
   - Use the email and password you just created to sign in
   - You now have full administrator access

### Security Notes

- ✅ This bootstrap screen **only appears when no admin exists**
- ✅ Once an admin is created, this screen is **permanently disabled**
- ✅ All subsequent users must be invited by an existing administrator
- ✅ Passwords are securely hashed using bcrypt

---

## Method 2: Manual Database Setup (Advanced)

If you need to create an admin account manually through the Convex dashboard:

### Steps

1. **Open Convex Dashboard**
   - Go to https://dashboard.convex.dev
   - Select your deployment

2. **Open Functions Tab**
   - Click on "Functions" in the left sidebar

3. **Run Bootstrap Function**
   - Find and run `auth:bootstrapFirstAdmin`
   - Provide the following arguments:
     ```json
     {
       "name": "Admin Name",
       "email": "admin@example.com",
       "password": "SecurePassword123"
     }
     ```

4. **Verify Creation**
   - Check the "Data" tab
   - Look in the `users` and `roles` tables
   - Confirm the admin user exists

---

## After Initial Setup

Once the first administrator is created:

### 1. Sign In
- Use the email and password created during bootstrap
- You'll be directed to the Admin Portal

### 2. Configure Locations
- Go to **Settings → Locations**
- Add your care facility locations
- Example: "Main Building", "West Wing", etc.

### 3. Invite Staff
- Go to **Employees** workspace
- Click "Invite Employee"
- Enter employee details:
  - Name
  - Work email
  - Role (Admin, Supervisor, or Staff)
  - Assigned locations
- Employee will receive an invitation email

### 4. Set Up Residents
- Go to **Residents** workspace
- Add resident profiles
- Upload ISP documents
- Configure fire evacuation plans

### 5. Configure Kiosks (Optional)
- Go to **Settings → Kiosk Management**
- Generate pairing tokens for physical kiosk devices
- Assign kiosks to specific locations

---

## Troubleshooting

### "Admin already exists" Error

**Problem**: You see this error when trying to create an admin

**Solution**: An administrator already exists. Use the sign-in form instead.

### Forgot Admin Password

**Problem**: Lost access to the admin account

**Solution**: 
1. Contact Convex support or your technical team
2. They can reset the password through the database
3. Or create a new admin account if necessary

### Bootstrap Screen Not Appearing

**Problem**: The bootstrap screen doesn't show

**Solution**:
1. Check if an admin already exists in the database
2. Clear browser cache and reload
3. Verify deployment is running correctly

---

## Security Best Practices

### Password Requirements
- ✅ Minimum 8 characters
- ✅ Use a mix of uppercase, lowercase, numbers, and symbols
- ✅ Avoid common words or patterns
- ✅ Use a password manager

### Account Security
- 🔒 Never share admin credentials
- 🔒 Use unique passwords for each admin
- 🔒 Regularly review user access in the audit logs
- 🔒 Remove access for terminated employees immediately

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
| Create first admin | Automatic on first visit |
| Sign in | Main page (after admin exists) |
| Invite employees | Admin Portal → Employees |
| Add residents | Admin Portal → Residents |
| Configure locations | Admin Portal → Settings → Locations |
| Set up kiosks | Admin Portal → Settings → Kiosk Management |
| View audit logs | Admin Portal → Settings → System |

---

**Last Updated**: January 2025  
**Version**: 1.0
