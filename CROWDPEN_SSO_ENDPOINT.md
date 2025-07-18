# Crowdpen SSO Endpoint Implementation

You need to create this endpoint in your **Crowdpen** app (not the marketplace):

## File: `/pages/api/auth/sso.js`

```javascript
import { getServerSession } from 'next-auth';
import { authOptions } from './[...nextauth]'; // NextAuth config in pages directory

/**
 * SSO endpoint for Crowdpen to handle marketplace login requests
 * URL: https://crowdpen.co/api/auth/sso?app=marketplace&callback=...&origin=...
 */
export default async function handler(req, res) {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { app, callback, origin } = req.query;
    
    console.log('SSO request received:', { app, callback, origin });
    
    // Validate the request
    if (app !== 'marketplace') {
      return res.status(400).json({ error: 'Invalid app parameter' });
    }
    
    if (!callback) {
      return res.status(400).json({ error: 'Missing callback URL' });
    }
    
    // Validate callback URL is from marketplace domain
    const allowedOrigins = [
      'http://localhost:3000',
      'https://crowdpen-marketplace.vercel.app',
      // Add other allowed marketplace domains
    ];
    
    const callbackUrl = new URL(callback);
    const isValidOrigin = allowedOrigins.some(allowed => 
      callbackUrl.origin === allowed || callbackUrl.origin === origin
    );
    
    if (!isValidOrigin) {
      return res.status(400).json({ error: 'Invalid callback URL' });
    }
    
    // Get the current user session
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user) {
      // User is not logged in, redirect to login with callback
      const loginUrl = `/login?callbackUrl=${encodeURIComponent(req.url)}`;
      console.log('User not logged in, redirecting to:', loginUrl);
      return res.redirect(302, loginUrl);
    }
    
    console.log('User is logged in:', session.user.email);
    
    // Determine which provider the user used to sign in
    // This requires storing the provider info in the session or user record
    // For now, we'll need to check the account table or add provider info to session
    
    // Get user's account information to determine the provider used
    let userProvider = 'email'; // default fallback
    
    try {
      // You'll need to import your Sequelize models at the top of the file
      // import sequelize from '../../../models/database'; // Adjust path as needed
      
      // Query your database to get the user's account provider using Sequelize
      const userAccount = await sequelize.models.Account.findOne({
        where: { userId: session.user.id },
        order: [['createdAt', 'DESC']] // Get most recent account
      });
      
      if (userAccount) {
        userProvider = userAccount.provider;
      }
    } catch (error) {
      console.error('Error fetching user provider:', error);
      // Fall back to email if we can't determine provider
    }
    
    console.log('User provider determined as:', userProvider);
    
    // User is logged in, redirect to marketplace with user data and provider info
    const userData = {
      email: session.user.email,
      name: session.user.name || '',
      image: session.user.image || '',
      id: session.user.id
    };
    
    // Create the callback URL with user data and provider info
    const callbackWithData = new URL(callback);
    callbackWithData.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
    callbackWithData.searchParams.set('provider', userProvider);
    
    console.log('Redirecting to marketplace with user data and provider:', userProvider);
    return res.redirect(302, callbackWithData.toString());
    
  } catch (error) {
    console.error('SSO endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

## Key Points:

1. **URL Pattern**: The endpoint should handle `GET /api/auth/sso`
2. **Parameters**: 
   - `app=marketplace` (identifies the requesting app)
   - `callback` (where to redirect back to)
   - `origin` (the marketplace origin URL)

3. **Logic**:
   - If user is logged in → redirect to marketplace callback with user data
   - If user is not logged in → redirect to Crowdpen login, then back to SSO endpoint

4. **Security**: Validate callback URLs to prevent redirect attacks

5. **After Login**: When user logs in to Crowdpen, they should be redirected back to this SSO endpoint, which will then redirect them to the marketplace.

This endpoint acts as the bridge between Crowdpen authentication and marketplace access.

## Summary

Once you create this `/pages/api/auth/sso.js` file in your Crowdpen app, the SSO flow will work as follows:

1. **User clicks SSO login on marketplace** → redirected to `https://crowdpen.co/api/auth/sso`
2. **If user is logged into Crowdpen** → immediately redirected back to marketplace with user data
3. **If user is not logged in** → redirected to Crowdpen login → after login, back to SSO endpoint → then to marketplace

The marketplace will then receive the user data and create a local session automatically.

Option 1: Custom OAuth Provider Create a custom OAuth provider for Crowdpen that returns user data and the original provider used

Option 2: Provider Pass-through

Crowdpen returns which provider the user used (email/github/google)
Marketplace automatically signs them in with that same provider
Use shared database to validate user exists
Option 3: Shared Session Token

Both apps use the same NextAuth secret and session configuration
Crowdpen creates a session token that marketplace can validate