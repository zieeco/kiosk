# Ezer - Client Handover Documentation

## 🎉 Welcome to Ezer Homecare Management System

This document provides everything you need to successfully deploy and manage your Ezer application.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Initial Setup](#initial-setup)
3. [Creating Your First Admin](#creating-your-first-admin)
4. [Post-Setup Configuration](#post-setup-configuration)
5. [User Management](#user-management)
6. [Technical Information](#technical-information)
7. [Support & Maintenance](#support--maintenance)

---

## System Overview

### What is Ezer?

Ezer is a comprehensive, HIPAA-compliant homecare management system that provides:

- ✅ **Resident Management** - Complete resident profiles and care documentation
- ✅ **Staff Time Tracking** - Clock in/out with selfie verification
- ✅ **Compliance Management** - ISP and Fire Evacuation plan tracking
- ✅ **Guardian Communication** - Secure checklist system for family engagement
- ✅ **Audit Trail** - Complete activity logging for compliance
- ✅ **Kiosk Mode** - Dedicated devices for staff clock-in/out

### Technology Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Convex (Real-time database and functions)
- **Authentication**: Convex Auth with password-based login
- **Email**: Resend API for notifications
- **Hosting**: Convex Cloud Platform

---

## Initial Setup

### Step 1: Access Your Deployment

Your Ezer application is deployed at:
```
https://fleet-bobcat-14.convex.app
```

**Custom Domain (if configured):**
```
https://myezer.org
```

**Convex Dashboard Access:**
```
https://dashboard.convex.dev/d/fleet-bobcat-14
```

### Step 2: Environment Variables

The following environment variables are already configured:

| Variable | Purpose | Status |
|----------|---------|--------|
| `CONVEX_DEPLOYMENT` | Deployment identifier | ✅ Configured |
| `CONVEX_OPENAI_API_KEY` | AI features (bundled) | ✅ Configured |
| `CONVEX_RESEND_API_KEY` | Email notifications (bundled) | ✅ Configured |
| `SITE_URL` | Application URL | ✅ Configured |

**To update environment variables:**
1. Go to Convex Dashboard → Settings → Environment Variables
2. Update `SITE_URL` to your production domain if using custom domain
3. (Optional) Add your own `OPENAI_API_KEY` or `RESEND_API_KEY` for higher limits

---

## Creating Your First Admin

### Automatic Bootstrap (Recommended)

When you first visit the application, you'll see a **"Create First Admin"** screen.

#### Steps:

1. **Navigate to your deployment URL**
   ```
   https://fleet-bobcat-14.convex.app
   ```

2. **Fill in the admin details:**
   - **Full Name**: Your name (e.g., "John Smith")
   - **Email**: Your email address (this becomes your username)
   - **Password**: Strong password (minimum 8 characters)
   - **Confirm Password**: Re-enter password

3. **Click "Create Admin Account"**
   - Wait for success message
   - Page will automatically reload

4. **Sign in with your new credentials**
   - Use the email and password you just created
   - You now have full administrator access

### Important Security Notes

- 🔒 The bootstrap screen **only appears once** (when no admin exists)
- 🔒 After the first admin is created, this screen is **permanently disabled**
- 🔒 All future users must be invited by an administrator
- 🔒 Passwords are securely hashed and never stored in plain text

### Alternative: Manual Setup via Dashboard

If needed, you can create an admin through the Convex dashboard:

1. Go to **Convex Dashboard → Functions**
2. Run `auth:bootstrapFirstAdmin` with:
   ```json
   {
     "name": "Admin Name",
     "email": "admin@example.com",
     "password": "SecurePassword123"
   }
   ```

---

## Post-Setup Configuration

After creating your first admin, follow these steps:

### 1. Configure Locations

**Path**: Admin Portal → Settings → Locations

Add all your care facility locations:
- Main Building
- West Wing
- East Wing
- Etc.

**Why**: Locations are used for:
- Staff assignments
- Resident placement
- Kiosk registration
- Compliance tracking

### 2. Invite Your Team

**Path**: Admin Portal → Employees

#### Invite Process:

1. Click **"Invite Employee"**
2. Enter details:
   - Name
   - Work email
   - Role (Admin, Supervisor, or Staff)
   - Assigned locations
3. Click **"Send Invite"**
4. Employee receives email with invitation link
5. They accept invite and create their password

#### Role Permissions:

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management, settings |
| **Supervisor** | Resident management, compliance, team oversight |
| **Staff** | Clock in/out, resident logs, basic care documentation |

### 3. Add Residents

**Path**: Admin Portal → Residents

For each resident:
1. Click **"Add Resident"**
2. Fill in profile information
3. Upload profile photo (optional)
4. Assign to location
5. Add guardian contacts

### 4. Upload Compliance Documents

#### ISP (Individual Service Plans)

**Path**: Admin Portal → Compliance → ISP

1. Select resident
2. Upload ISP document (PDF/DOCX)
3. Set effective date
4. Activate the plan

#### Fire Evacuation Plans

**Path**: Admin Portal → Compliance → Fire Evacuation

1. Select resident
2. Upload evacuation plan
3. Add mobility notes and special instructions

### 5. Set Up Kiosks (Optional)

**Path**: Admin Portal → Settings → Kiosk Management

If you have dedicated devices for staff clock-in:

1. Click **"Generate Pairing Token"**
2. Select location
3. Enter device label
4. Copy the pairing code
5. On the kiosk device, go to `/kiosk` route
6. Enter the pairing code
7. Kiosk is now registered

---

## User Management

### Adding New Users

**Admins can:**
- Invite employees
- Assign roles and locations
- Resend invitations
- Deactivate accounts

**Process:**
1. Admin Portal → Employees
2. Invite Employee
3. Employee receives email
4. Employee accepts invite
5. Employee creates password
6. Employee can now sign in

### Removing Users

**To deactivate an employee:**
1. Admin Portal → Employees
2. Find the employee
3. Click "..." menu
4. Select "Deactivate"
5. Confirm action

**Note**: Deactivated users cannot sign in but their historical data remains for audit purposes.

### Password Resets

**If a user forgets their password:**

Currently, password resets must be handled manually:
1. Admin can create a new invite for the user
2. User accepts the new invite
3. User creates a new password

**Future Enhancement**: Self-service password reset can be added if needed.

---

## Technical Information

### Database Structure

Your data is stored in Convex with the following main tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `roles` | User role assignments |
| `employees` | Employee profiles and invitations |
| `residents` | Resident profiles |
| `guardians` | Guardian/family contacts |
| `shifts` | Staff clock-in/out records |
| `resident_logs` | Care documentation |
| `isp_files` | ISP documents |
| `fire_evac` | Fire evacuation plans |
| `audit_logs` | Complete activity audit trail |

### Backup & Data Export

**Automatic Backups:**
- Convex automatically backs up your data
- Point-in-time recovery available
- Contact Convex support for restore requests

**Manual Export:**
1. Go to Convex Dashboard → Data
2. Select table
3. Click "Export" to download as JSON

### Security Features

- ✅ **Authentication**: Secure password-based login
- ✅ **Authorization**: Role-based access control
- ✅ **Audit Logging**: All actions tracked
- ✅ **Data Encryption**: Data encrypted at rest and in transit
- ✅ **HIPAA Compliance**: Designed for healthcare data
- ✅ **Selfie Verification**: Optional photo verification for clock-in

### Performance & Limits

- **Real-time Updates**: Changes sync instantly across all devices
- **Concurrent Users**: Unlimited
- **File Storage**: Unlimited (for ISP docs, photos, etc.)
- **Database Size**: Scales automatically

---

## Support & Maintenance

### Regular Maintenance Tasks

#### Daily
- ✅ Review compliance alerts
- ✅ Check staff clock-in/out records
- ✅ Monitor system notifications

#### Weekly
- ✅ Review audit logs for unusual activity
- ✅ Check for pending employee invitations
- ✅ Verify ISP and fire evac plan status

#### Monthly
- ✅ Review user access and permissions
- ✅ Update resident information
- ✅ Archive old documents
- ✅ Review system usage and performance

### Getting Help

#### Documentation

- **Admin Guide**: `USER_GUIDE_ADMIN.md`
- **Supervisor Guide**: `USER_GUIDE_SUPERVISOR.md`
- **Staff Guide**: `USER_GUIDE_STAFF.md`
- **Setup Guide**: `ADMIN_SETUP_GUIDE.md`

#### Technical Support

**Developer**: Bold Ideas Innovations Ltd.

**Convex Platform Support**:
- Dashboard: https://dashboard.convex.dev
- Documentation: https://docs.convex.dev
- Community: https://convex.dev/community

#### Common Issues

**Issue**: Can't sign in
- **Solution**: Verify email and password are correct
- **Solution**: Check if account is active
- **Solution**: Try clearing browser cache

**Issue**: Invitation email not received
- **Solution**: Check spam folder
- **Solution**: Verify email address is correct
- **Solution**: Admin can resend invitation

**Issue**: Kiosk not working
- **Solution**: Verify kiosk is paired correctly
- **Solution**: Check internet connection
- **Solution**: Re-pair the kiosk if needed

---

## Deployment Checklist

Use this checklist when setting up for the first time:

- [ ] Access deployment URL
- [ ] Create first admin account
- [ ] Sign in as admin
- [ ] Configure locations
- [ ] Update environment variables (if needed)
- [ ] Invite supervisor(s)
- [ ] Invite staff members
- [ ] Add resident profiles
- [ ] Upload ISP documents
- [ ] Upload fire evacuation plans
- [ ] Set up kiosks (if applicable)
- [ ] Test staff clock-in/out
- [ ] Test resident log creation
- [ ] Test guardian checklist system
- [ ] Review audit logs
- [ ] Train staff on system usage

---

## Next Steps

1. **Complete Initial Setup** (see checklist above)
2. **Train Your Team** (use the user guides)
3. **Start Using the System** (begin with a pilot group)
4. **Monitor & Adjust** (review usage and feedback)
5. **Scale Up** (add more users and residents)

---

## Contact Information

**Application URL**: https://fleet-bobcat-14.convex.app  
**Custom Domain**: https://myezer.org (if configured)  
**Dashboard URL**: https://dashboard.convex.dev/d/fleet-bobcat-14  
**Developer**: Bold Ideas Innovations Ltd.  
**Last Updated**: January 2025  
**Version**: 1.0

---

## Appendix: Quick Reference

### Admin Portal Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard |
| `/admin/employees` | Employee management |
| `/admin/residents` | Resident management |
| `/admin/compliance` | ISP & fire evac management |
| `/admin/settings` | System settings |
| `/kiosk` | Kiosk mode for clock-in devices |

### Key Features

- **Real-time Sync**: All changes update instantly
- **Mobile Friendly**: Works on phones and tablets
- **Offline Capable**: Basic functions work offline
- **Audit Trail**: Complete activity logging
- **Secure**: HIPAA-compliant architecture

---

**🎉 Congratulations! You're ready to use Ezer.**

If you have any questions, refer to the user guides or contact support.
