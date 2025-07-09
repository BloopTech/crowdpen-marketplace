import { NextResponse } from "next/server";
import axios from "axios";
import { cookies } from "next/headers";

/**
 * This is a proxy API endpoint that fetches the user's session from Crowdpen
 * It does this server-side to avoid CORS issues
 */
export async function GET(request) {
  try {
    console.log("Fetching Crowdpen session via proxy...");
    
    // Get all cookies from the request to forward to Crowdpen
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Log all cookies we found
    console.log(`Found ${allCookies.length} cookies to forward:`);
    allCookies.forEach(cookie => {
      console.log(`- ${cookie.name}: [value hidden]`);
    });
    
    // Format cookies as a cookie header string
    const cookieHeader = allCookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    
    // Add a timestamp to prevent caching
    const timestamp = new Date().getTime();
    
    // Make request to Crowdpen session endpoint with cookies
    const response = await axios.get(`https://crowdpen.co/api/auth/session?_=${timestamp}`, {
      headers: {
        Cookie: cookieHeader,
      },
      withCredentials: true
    });
    
    console.log("Crowdpen session response status:", response.status);
    // Return the data from Crowdpen - but if it's empty, try to handle it gracefully
    if (!response.data || Object.keys(response.data).length === 0) {
      // If we got an empty response, create a dummy response for testing
      // Only do this in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Empty response from Crowdpen, providing mock data for testing');
        return NextResponse.json({
          user: {
            email: 'test@example.com',
            name: 'Test User'
          }
        });
      }
    }
    
    return NextResponse.json(response.data);
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
