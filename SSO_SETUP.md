# Crowdpen Marketplace SSO Setup

## Environment Variables Required

Add the following environment variable to your `.env.local` file:

```env
# Crowdpen main app URL for SSO
CROWDPEN_URL=https://crowdpen.co
# For local development, use: http://localhost:3000
```

## How SSO Works

1. **Session Check**: When a user visits the marketplace, the app automatically checks if they have an active Crowdpen session
2. **Auto-Login**: If an active session is found, the user is automatically signed in to the marketplace
3. **Manual Login**: If no session exists, clicking the login button will redirect to Crowdpen for authentication
4. **Shared Database**: Both apps use the same PostgreSQL database, so user data is synchronized

## SSO Flow

```
User visits Marketplace
     ↓
Check for Crowdpen session (/api/auth/check-crowdpen-session)
     ↓
If session exists:
  → Create JWT token (/api/auth/create-sso-token)
  → Sign in to Marketplace (NextAuth)
     ↓
If no session:
  → Show login dialog
  → Redirect to Crowdpen login
  → Return to Marketplace after login
```

## Files Modified/Created

- `app/api/auth/[...nextauth]/route.js` - Added JWT import, fixed database operations
- `app/api/auth/check-crowdpen-session/route.js` - New endpoint to check Crowdpen sessions
- `app/api/auth/create-sso-token/route.js` - New endpoint to create SSO tokens
- `app/hooks/useCrowdpenSSO.js` - New hook for SSO functionality
- `app/(auth)/login/index.js` - Updated login dialog with SSO support
- `app/components/marketplace-header.js` - Updated header with SSO status

## Testing

1. Start both Crowdpen and Crowdpen-Marketplace apps
2. Sign in to Crowdpen in one browser tab
3. Visit Crowdpen-Marketplace in another tab
4. You should be automatically signed in to the marketplace
