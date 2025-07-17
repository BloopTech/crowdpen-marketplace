import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request) {
  try {
    // Get the Crowdpen URL from environment variables
    const crowdpenUrl = process.env.CROWDPEN_URL || 'https://crowdpen.co';
    
    console.log('Checking Crowdpen session at:', crowdpenUrl);
    
    // Forward the request to Crowdpen's session endpoint
    // This will include any cookies from the original request
    const response = await axios.get(`${crowdpenUrl}/api/auth/session`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
        'User-Agent': request.headers.get('user-agent') || '',
        'Accept': 'application/json',
      },
      withCredentials: true,
      timeout: 10000,
    });
    //console.log('Crowdpen session response..................................', response)
    const sessionData = response.data;
    
    // If there's a valid session, return the user data
    if (sessionData && sessionData.user) {
      console.log('Found active Crowdpen session for:', sessionData.user.email);
      return NextResponse.json({
        hasSession: true,
        user: sessionData.user,
      });
    }
    
    // No active session
    console.log('No active Crowdpen session found');
    return NextResponse.json({
      hasSession: false,
    });
    
  } catch (error) {
    console.error('Error checking Crowdpen session:', error.message);
    
    // If there's an error (like network timeout or 401), assume no session
    return NextResponse.json({
      hasSession: false,
      error: error.message,
    });
  }
}
