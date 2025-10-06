## Forgot Password Feature Documentation

### Overview
A complete password reset flow has been implemented for the El-Elyon Properties care management system. Users can now reset their passwords via email if they forget them.

---

## Features

### 1. **Password Reset Request**
- Users can click "Forgot password?" on the sign-in page
- Enter their email address to receive reset instructions
- System prevents email enumeration (always shows success message)
- Reset tokens expire after 1 hour

### 2. **Email Delivery**
- Professional email template with branding
- Secure reset link with unique token
- Clear instructions and expiration notice
- Sent via Resend API

### 3. **Password Reset**
- Secure token validation
- Password strength requirements (minimum 8 characters)
- Password confirmation field
- One-time use tokens
- Automatic redirect to sign-in after success

---

## User Flow

### Step 1: Request Reset
1. User clicks "Forgot password?" on sign-in page
2. User enters their email address
3. System generates secure token and sends email
4. User sees confirmation message

### Step 2: Receive Email
1. User receives email with reset link
2. Email includes:
   - Personalized greeting
   - Reset button
   - Plain text link (backup)
   - Expiration notice (1 hour)
   - Security notice

### Step 3: Reset Password
1. User clicks link in email
2. System validates token
3. User enters new password (twice)
4. System updates password
5. User redirected to sign-in
6. Token marked as used

---

## Technical Implementation

### Backend Functions (`convex/passwordReset.ts`)

#### `requestPasswordReset` (Mutation)
- **Purpose**: Creates reset token and prepares email data
- **Security**: Prevents email enumeration
- **Returns**: Token info for email sending

#### `sendPasswordResetEmail` (Action)
- **Purpose**: Sends reset email via Resend
- **Template**: Professional HTML email
- **Link**: Includes secure token

#### `verifyResetToken` (Query)
- **Purpose**: Validates token before password reset
- **Checks**: Expiration, usage, existence

#### `resetPassword` (Mutation)
- **Purpose**: Updates password with new hash
- **Security**: Validates token, hashes password
- **Audit**: Logs password reset event

### Database Schema

New table: `password_reset_tokens`
```typescript
{
  userId: Id<"users">,
  token: string,           // Unique reset token
  expiresAt: number,       // Expiration timestamp
  used: boolean,           // One-time use flag
  createdAt: number,       // Creation timestamp
}
```

Indexes:
- `by_token`: Fast token lookup
- `by_userId`: User's reset history

### Frontend Components

#### `ForgotPasswordPage.tsx`
- Email input form
- Success confirmation
- Error handling
- Accessible at `/forgot`

#### `ResetPasswordPage.tsx`
- Token validation
- Password input (with confirmation)
- Strength requirements
- Success/error states
- Accessible at `/reset-password?token=XXX`

---

## Security Features

### 1. **Token Security**
- Cryptographically random tokens
- 1-hour expiration
- One-time use only
- Stored securely in database

### 2. **Email Enumeration Prevention**
- Always shows success message
- Doesn't reveal if email exists
- Prevents account discovery

### 3. **Password Requirements**
- Minimum 8 characters
- Bcrypt hashing (10 rounds)
- Confirmation required

### 4. **Audit Trail**
- All reset requests logged
- Password changes tracked
- Includes timestamp and user ID

---

## Configuration

### Environment Variables Required
```bash
CONVEX_RESEND_API_KEY=your_resend_api_key
```

### Email Settings
- **From**: El-Elyon Properties <noreply@care-app.convex.app>
- **Subject**: Reset Your Password
- **Template**: HTML with inline styles

---

## URLs

### Production URLs
- **Forgot Password**: `https://fleet-bobcat-14.convex.app/forgot`
- **Reset Password**: `https://fleet-bobcat-14.convex.app/reset-password?token=XXX`
- **Sign In**: `https://fleet-bobcat-14.convex.app/`

---

## Error Handling

### Common Errors

1. **Invalid Token**
   - Message: "Invalid reset token"
   - Action: Redirect to request new link

2. **Expired Token**
   - Message: "This reset link has expired"
   - Action: Redirect to request new link

3. **Used Token**
   - Message: "This reset link has already been used"
   - Action: Redirect to request new link

4. **Password Mismatch**
   - Message: "Passwords do not match"
   - Action: User corrects input

5. **Weak Password**
   - Message: "Password must be at least 8 characters"
   - Action: User enters stronger password

---

## Testing Checklist

- [x] Request password reset with valid email
- [x] Request password reset with invalid email
- [x] Receive reset email
- [x] Click reset link
- [x] Validate token expiration
- [x] Validate one-time use
- [x] Reset password successfully
- [x] Sign in with new password
- [x] Verify old password doesn't work
- [x] Check audit logs

---

## User Instructions

### For End Users

**To Reset Your Password:**

1. Go to the sign-in page
2. Click "Forgot password?" below the sign-in button
3. Enter your email address
4. Check your email for reset instructions
5. Click the reset link (valid for 1 hour)
6. Enter your new password twice
7. Click "Reset Password"
8. Sign in with your new password

**Important Notes:**
- Reset links expire after 1 hour
- Each link can only be used once
- If you don't receive an email, check your spam folder
- Contact your administrator if you continue having issues

---

## Admin Notes

### Monitoring
- Check `password_reset_tokens` table for reset activity
- Review `audit_logs` for password reset events
- Monitor email delivery via Resend dashboard

### Troubleshooting
1. **User not receiving emails**
   - Verify Resend API key is configured
   - Check Resend dashboard for delivery status
   - Verify email address is correct

2. **Token expired**
   - User must request new reset link
   - Tokens expire after 1 hour for security

3. **Multiple reset requests**
   - Each request generates new token
   - Old tokens remain valid until expiration
   - Consider implementing rate limiting if abused

---

## Future Enhancements

### Potential Improvements
1. **Rate Limiting**: Prevent abuse of reset requests
2. **SMS Reset**: Alternative to email
3. **Security Questions**: Additional verification
4. **Password History**: Prevent reuse of recent passwords
5. **2FA Integration**: Require 2FA for password reset
6. **Admin Override**: Allow admins to reset user passwords
7. **Email Templates**: Customizable branding
8. **Notification**: Alert user when password is changed

---

## Maintenance

### Regular Tasks
- Monitor reset token table size
- Clean up expired tokens (optional)
- Review audit logs for suspicious activity
- Update email templates as needed

### Database Cleanup (Optional)
```typescript
// Delete expired tokens older than 7 days
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const expiredTokens = await ctx.db
  .query("password_reset_tokens")
  .filter(q => q.lt(q.field("expiresAt"), sevenDaysAgo))
  .collect();
```

---

**Last Updated:** 2024
**Feature Status:** ✅ Production Ready
**Documentation Version:** 1.0
