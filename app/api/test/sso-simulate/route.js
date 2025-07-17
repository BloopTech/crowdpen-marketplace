import { NextResponse } from 'next/server';

/**
 * Test endpoint to simulate what Crowdpen should do for SSO callback
 * This helps test the SSO flow without needing the actual Crowdpen app
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const callback = searchParams.get('callback');
    const origin = searchParams.get('origin');
    
    if (!callback) {
      return NextResponse.json({ error: 'No callback URL provided' }, { status: 400 });
    }
    
    // Simulate a successful login with test user data
    const testUser = {
      id: 'test-user-123',
      email: 'test@crowdpen.co',
      name: 'Test User',
      image: 'https://via.placeholder.com/150'
    };
    
    // Create the callback URL with user data
    const callbackUrl = new URL(callback);
    callbackUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(testUser)));
    callbackUrl.searchParams.set('callbackUrl', origin || '/');
    
    console.log('Simulating SSO callback to:', callbackUrl.toString());
    
    // Redirect to the callback URL (this is what Crowdpen should do)
    return NextResponse.redirect(callbackUrl.toString());
    
  } catch (error) {
    console.error('SSO simulation error:', error);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
