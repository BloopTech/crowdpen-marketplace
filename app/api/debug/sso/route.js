import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * This is a diagnostic endpoint to check all SSO-related state
 */
export async function GET(request) {
  try {
    // Get all cookies
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const paramEntries = Array.from(searchParams.entries());
    
    // Create a diagnostic object with all relevant info
    const diagnosticInfo = {
      cookies: allCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.name.includes('token') || cookie.name.includes('state') ? 
              cookie.value : '[hidden]',
        path: cookie.path,
        domain: cookie.domain,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite
      })),
      authCookies: {
        sessionToken: cookieStore.get('__Secure-next-auth.session-token')?.value ? 'Present' : 'Missing',
        csrfToken: cookieStore.get('__Host-next-auth.csrf-token')?.value ? 'Present' : 'Missing',
        callbackUrl: cookieStore.get('__Secure-next-auth.callback-url')?.value ? 'Present' : 'Missing',
      },
      searchParams: paramEntries,
      headers: {
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        userAgent: request.headers.get('user-agent'),
      },
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'Not set',
        NEXT_PUBLIC_NEXTAUTH_URL: process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'Not set',
        CROWDPEN_URL: process.env.CROWDPEN_URL || 'Not set',
        NODE_ENV: process.env.NODE_ENV || 'Not set',
      }
    };
    
    // Check if there's an active session in NextAuth
    const hasSession = cookieStore.get('__Secure-next-auth.session-token') !== undefined;
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      hasSession,
      diagnosticInfo
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
