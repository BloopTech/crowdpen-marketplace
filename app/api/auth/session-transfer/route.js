import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import axios from "axios";
import jwt from "jsonwebtoken";

/**
 * Direct session transfer endpoint from Crowdpen to Marketplace
 * This endpoint will:
 * 1. Extract Crowdpen auth cookies from request
 * 2. Verify them with Crowdpen
 * 3. Create equivalent cookies in Marketplace
 * 4. Return success/failure status
 */
export async function POST(request) {
  try {
    // Get all cookies from the request
    const requestCookies = request.headers.get('cookie') || '';
    console.log('Received cookies for session transfer:', requestCookies);
    
    // Extract auth-related cookies from request
    const authCookies = {};
    requestCookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && name.includes('next-auth')) {
        authCookies[name] = value;
      }
    });
    
    console.log('Auth cookies found:', Object.keys(authCookies));
    
    // If no auth cookies found, try to get them from the request body
    const body = await request.json().catch(() => ({}));
    if (Object.keys(authCookies).length === 0 && body.cookies) {
      console.log('Using cookies from request body');
      body.cookies.forEach(cookie => {
        if (cookie.name && cookie.name.includes('next-auth')) {
          authCookies[cookie.name] = cookie.value;
        }
      });
    }
    
    // Check if we have the session token
    const sessionToken = authCookies['__Secure-next-auth.session-token'] || 
                         body.sessionToken;
                         
    if (!sessionToken) {
      console.error('No session token found in request');
      return NextResponse.json({ 
        success: false, 
        error: 'No session token provided' 
      }, { status: 400 });
    }
    
    // Verify the token with Crowdpen
    const crowdpenUrl = process.env.NEXT_PUBLIC_CROWDPEN_URL || 'https://crowdpen.co';
    const verifyResponse = await axios.post(
      `${crowdpenUrl}/api/auth/verify-session`, 
      { sessionToken },
      { 
        headers: {
          'Content-Type': 'application/json',
          'Cookie': requestCookies
        } 
      }
    ).catch(error => {
      console.error('Error verifying session with Crowdpen:', error.message);
      return { data: { error: error.message } };
    });
    
    if (!verifyResponse.data?.user) {
      console.error('Invalid session or verification failed');
      return NextResponse.json({ 
        success: false, 
        error: 'Session verification failed',
        details: verifyResponse.data?.error || 'Unknown error'
      }, { status: 401 });
    }
    
    // Session is valid, create equivalent cookies for Marketplace
    const user = verifyResponse.data.user;
    console.log('Verified user:', user.email);
    
    // Use the SAME session token that Crowdpen issued
    const token = sessionToken;
    
    // Set the cookies for the Marketplace using the exact NextAuth cookie names
    const cookieStore = cookies();

    // 1. Session token cookie
    cookieStore.set('__Secure-next-auth.session-token', token, {
      path: '/',
      secure: true,
      sameSite: 'lax', // Must be 'lax' or 'none' for cross-site
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true
    });

    // 2. CSRF token – reuse the state value
    cookieStore.set('__Host-next-auth.csrf-token', csrfToken || state, {
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true
    });

    // 3. Callback URL so NextAuth knows where we came from
    cookieStore.set('__Secure-next-auth.callback-url', returnUrl, {
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true
    });
    
    // CSRF token for form submissions
    cookieStore.set('__Host-next-auth.csrf-token', body.csrfToken || Math.random().toString(36).substring(2), {
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: true
    });
    
    // Set return URL if provided
    const returnUrl = process.env.NEXTAUTH_URL || body.returnUrl;
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      },
      returnUrl
    });
  } catch (error) {
    console.error('Error transferring session:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
