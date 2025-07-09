import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from 'next/headers';

/**
 * Handle Crowdpen authentication callback
 * This endpoint is called when a user is redirected back from Crowdpen's login page
 * 
 * After logging in at Crowdpen, the user should have valid Crowdpen cookies
 * We need to check for these cookies and sign in the user with our local NextAuth
 */
export async function GET(request) {
  try {
    console.log('Crowdpen callback handler activated');
    
    // Try multiple methods to get the user's identity
    // Method 1: Check if Crowdpen passed email directly in the URL params
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    let callbackUrl = url.searchParams.get("callbackUrl") || '/';
    
    if (email) {
      console.log(`Email provided directly in URL params: ${email}`);
      
      // Redirect to NextAuth credentials endpoint with the email
      const signInUrl = `/api/auth/signin/credentials?${new URLSearchParams({
        email,
        callbackUrl
      }).toString()}`;
      
      console.log(`Redirecting to sign in: ${signInUrl}`);
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
    
    // Method 2: Check for Crowdpen session cookies
    console.log('Checking for Crowdpen session cookies');
    
    // Get all the cookies from the request
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    // Important: Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    // Make request to Crowdpen session endpoint with all cookies
    const response = await axios.get(`https://crowdpen.co/api/auth/session?_=${timestamp}`, {
      headers: { Cookie: cookieHeader },
      withCredentials: true
    });
    
    console.log('Crowdpen session response status:', response.status);
    
    // If we found a valid user session, use it to sign in
    if (response?.data?.user?.email) {
      const userEmail = response.data.user.email;
      console.log(`Found valid Crowdpen session for: ${userEmail}`);
      
      // Redirect to NextAuth credentials endpoint with the email
      const signInUrl = `/api/auth/signin/credentials?${new URLSearchParams({
        email: userEmail,
        callbackUrl
      }).toString()}`;
      
      console.log(`Redirecting to sign in: ${signInUrl}`);
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
    
    // For development testing only
    if (process.env.NODE_ENV === 'development') {
      console.log('DEV MODE: Using test email for development');
      const testEmail = 'test@example.com';
      
      const signInUrl = `/api/auth/signin/credentials?${new URLSearchParams({
        email: testEmail,
        callbackUrl
      }).toString()}`;
      
      return NextResponse.redirect(new URL(signInUrl, request.url));
    }
    
    // No valid session found
    console.log('No Crowdpen session found, redirecting to login page');
    return NextResponse.redirect(new URL('/login?error=NoSession&message=No+valid+Crowdpen+session+found', request.url));
  } catch (error) {
    console.error("Crowdpen callback error:", error.message, error.stack);
    return NextResponse.redirect(new URL(`/login?error=CallbackError&message=${encodeURIComponent(error.message)}`, request.url));
  }
}
