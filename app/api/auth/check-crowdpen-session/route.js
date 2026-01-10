import { NextResponse } from 'next/server';
import { getRequestIdFromHeaders, reportError } from "../../../lib/observability/reportError";

export const runtime = "nodejs";

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  try {
    // Cross-origin cookie forwarding is unreliable between different domains
    // Instead of trying to check Crowdpen sessions directly, we'll return false
    // and let the SSO flow handle the redirect to Crowdpen where the session check happens
    
    // Always return no session - this forces the SSO flow which is more reliable
    // The SSO flow will redirect to Crowdpen where the actual session check happens
    // If there's a session, Crowdpen will redirect back with user data
    // If no session, Crowdpen will show login form first
    return NextResponse.json({
      hasSession: false,
      reason: 'Deferring to SSO flow for reliable cross-domain session detection'
    });
    
  } catch (error) {
    await reportError(error, {
      route: "/api/auth/check-crowdpen-session",
      method: "GET",
      status: 500,
      requestId,
      tag: "check_crowdpen_session",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        hasSession: false,
        ...(isProd ? {} : { error: error?.message }),
      },
      { status: 500 }
    );
  }
}
