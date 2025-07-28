import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    // Cross-origin cookie forwarding is unreliable between different domains
    // Instead of trying to check Crowdpen sessions directly, we'll return false
    // and let the SSO flow handle the redirect to Crowdpen where the session check happens
    
    console.log('Session check: Deferring to SSO flow for reliable session detection');
    
    // Always return no session - this forces the SSO flow which is more reliable
    // The SSO flow will redirect to Crowdpen where the actual session check happens
    // If there's a session, Crowdpen will redirect back with user data
    // If no session, Crowdpen will show login form first
    return NextResponse.json({
      hasSession: false,
      reason: 'Deferring to SSO flow for reliable cross-domain session detection'
    });
    
  } catch (error) {
    console.error('Error in session check endpoint:', error.message);
    
    return NextResponse.json({
      hasSession: false,
      error: error.message,
    });
  }
}
