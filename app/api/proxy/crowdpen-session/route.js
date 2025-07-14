import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";
import jwt from 'jsonwebtoken';

/**
 * Helper function to extract and format NextAuth cookies from request
 */
function getCrowdpenAuthCookies(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  
  // Extract all cookies from the header
  const cookiePairs = cookieHeader.split(';').map(cookie => cookie.trim());
  
  // Filter for only NextAuth related cookies
  const authCookies = cookiePairs
    .filter(cookie => {
      const name = cookie.split('=')[0];
      return name && (
        name.includes('next-auth') || 
        name.includes('__Host-next-auth') || 
        name.includes('__Secure-next-auth')
      );
    })
    .join('; ');
  
  console.log(`Found ${authCookies.split(';').length} auth cookies to forward`);
  
  return authCookies;
}

/**
 * This is a proxy API endpoint that fetches the user's session from Crowdpen
 * It does this server-side to avoid CORS issues and generates a token for SSO
 */
export async function GET(request) {
  try {
    console.log("Fetching Crowdpen session via proxy...");
    
    // Get Crowdpen URL from environment, fallback to production URL
    const crowdpenUrl = process.env.NEXT_PUBLIC_CROWDPEN_URL || 'https://crowdpen.co';
    
    // Extract all authentication cookies to forward
    const authCookies = getCrowdpenAuthCookies(request);
    console.log('Forwarding auth cookies to Crowdpen:', authCookies);

    // Make request to Crowdpen's session endpoint
    const response = await axios.get(`${crowdpenUrl}/api/auth/session`, {
      headers: {
        Cookie: authCookies,
        'User-Agent': request.headers.get('user-agent') || ''
      },
      withCredentials: true
    });
    
    console.log("Crowdpen session response status:", response.status);
    
    // Check if we have a valid response with user data
    if (response.data?.user?.email) {
      // We found an authenticated user, generate a token for our SSO flow
      const user = response.data.user;
      
      // Create a JWT token to represent this verified user from Crowdpen
      // This token will be short-lived and only used for the SSO process
      const token = jwt.sign(
        { 
          email: user.email,
          name: user.name || '',
          image: user.image || '',
          id: user.id || '',
          source: 'crowdpen_sso',
          timestamp: Date.now()
        },
        process.env.NEXTAUTH_SECRET, // Use the same secret as NextAuth for compatibility
        { expiresIn: '5m' } // Short expiration time for security
      );
      
      // Return both the user data and the token
      return NextResponse.json({
        user,
        token
      });
    } 
    // Empty or invalid response
    else {
      // If we got an empty response and we're in development, provide mock data
      if (process.env.NODE_ENV === 'development' && process.env.MOCK_SSO === 'true') {
        console.log('Empty response from Crowdpen, providing mock data for testing');
        
        const mockUser = {
          email: 'test@example.com',
          name: 'Test User',
          id: '123456'
        };
        
        // Create a mock token
        const mockToken = jwt.sign(
          { 
            email: mockUser.email,
            name: mockUser.name,
            id: mockUser.id,
            source: 'crowdpen_sso_mock',
            timestamp: Date.now()
          },
          process.env.NEXTAUTH_SECRET,
          { expiresIn: '5m' }
        );
        
        return NextResponse.json({
          user: mockUser,
          token: mockToken
        });
      }
      
      // No active session found
      return NextResponse.json({ noSession: true });
    }
  } catch (error) {
    console.error('Error proxying Crowdpen session:', error.message);
    // Return a more detailed error for debugging
    return NextResponse.json(
      { 
        error: 'Failed to fetch Crowdpen session', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
}
