import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user'); // User data passed as JSON string from Crowdpen
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    
    console.log('SSO callback received:', { 
      user: user ? 'present' : 'missing',
      callbackUrl 
    });
    
    if (user) {
      // User data callback - pass user data directly to sign-in page
      try {
        const userData = JSON.parse(decodeURIComponent(user));
        console.log('Received user data for:', userData.email);
        
        // Validate user data
        if (!userData.email) {
          console.error('Invalid user data - missing email');
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }
        
        // Redirect to client-side sign-in handler with user data
        const response = NextResponse.redirect(new URL(`/auth/sso-signin?user=${encodeURIComponent(user)}&callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url));
        return response;
      } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
      }
    } else {
      console.error('No token or user data provided in SSO callback');
      return NextResponse.redirect(new URL('/auth/error?error=NoToken', request.url));
    }
    
  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=CallbackError', request.url));
  }
}
