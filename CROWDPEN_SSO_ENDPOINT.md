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
    
    // Check if user is already logged in
    const session = await getServerSession(req, res, authOptions);
    
    if (session?.user) {
      // User is logged in, redirect to marketplace with user data
      console.log('User is logged in, redirecting to marketplace with user data');
      
      const userData = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      };
      
      // Create callback URL with user data
      const redirectUrl = new URL(callback);
      redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));
      redirectUrl.searchParams.set('callbackUrl', origin || '/');
      
      return res.redirect(redirectUrl.toString());
    } else {
      // User is not logged in, redirect to Crowdpen login with return URL
      console.log('User not logged in, redirecting to Crowdpen login');
      
      // Create the full current URL for callback after login
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const currentUrl = `${protocol}://${host}${req.url}`;
      
      // Redirect to login with callback to this same SSO endpoint
      const loginUrl = `/auth/signin?callbackUrl=${encodeURIComponent(currentUrl)}`;
      
      return res.redirect(loginUrl);
    }
    
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
