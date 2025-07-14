import { NextResponse } from "next/server";
import { cookies } from "next/headers";
// Remove client-side import that's not available in server component
// import { signIn } from "next-auth/react";

/**
 * Special handler for Crowdpen SSO initiation
 * This route creates the proper redirect to Crowdpen's login page with SSO parameters
 */
export async function GET(request) {
  const getCookies = await cookies();


  try {
    const { searchParams } = new URL(request.url);
    const callbackUrl = process.env.NEXTAUTH_URL  || searchParams.get('callbackUrl');
    
    // Generate a random state to prevent CSRF attacks
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store state and callback URL using the SAME cookie names NextAuth uses
    getCookies.set('__Host-next-auth.csrf-token', state, {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: 60 * 10, // 10 minutes
      sameSite: 'lax'
    });
    
    getCookies.set('__Secure-next-auth.callback-url', callbackUrl, {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: 60 * 10,
      sameSite: 'lax'
    });
    
    // Determine the callback URL for Crowdpen to redirect back to
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'http://localhost:3000';
    const callbackUri = `${baseUrl}/api/auth/callback/crowdpen`;
    
    // Build the Crowdpen login URL with proper parameters
    const crowdpenUrl = process.env.NEXT_PUBLIC_CROWDPEN_URL || 'https://crowdpen.co';
    const loginUrl = `${crowdpenUrl}/login?sso=marketplace&callbackUrl=${encodeURIComponent(callbackUri)}&state=${encodeURIComponent(state)}`;
    
    console.log('Redirecting to Crowdpen login at:', loginUrl);
    
    // Redirect to Crowdpen login
    return NextResponse.redirect(loginUrl);
  } catch (error) {
    console.error('Error initiating Crowdpen SSO:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
