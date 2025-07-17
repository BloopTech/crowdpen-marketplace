import { NextResponse } from 'next/server';
import { handleUserData } from '../../[...nextauth]/route';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../[...nextauth]/route';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user'); // User data passed as JSON string from Crowdpen
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    
    console.log('=== SSO CALLBACK RECEIVED ===');
    console.log('SSO callback params:', { 
      user: user ? 'present' : 'missing',
      callbackUrl 
    });
    
    if (user) {
      try {
        const userData = JSON.parse(decodeURIComponent(user));
        console.log('Parsed user data for:', userData.email);
        
        // Validate user data
        if (!userData.email) {
          console.error('Invalid user data - missing email');
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }
        
        // Create or find user in database using handleUserData
        console.log('=== CREATING DATABASE USER FROM SSO DATA ===');
        const dbUser = await handleUserData(JSON.stringify(userData));
        
        if (!dbUser) {
          console.error('Failed to create/find user in database');
          return NextResponse.redirect(new URL('/auth/error?error=UserCreationFailed', request.url));
        }
        
        console.log('=== DATABASE USER CREATED/FOUND ===');
        console.log('User ID:', dbUser.id, 'Email:', dbUser.email);
        
        // Create NextAuth session by making a request to the credentials endpoint
        const baseUrl = new URL(request.url).origin;
        const signInResponse = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            user: JSON.stringify(userData),
            redirect: 'false',
            json: 'true'
          })
        });
        
        console.log('=== SIGNIN RESPONSE ===');
        console.log('Status:', signInResponse.status);
        
        if (signInResponse.ok) {
          console.log('=== SSO SESSION CREATED SUCCESSFULLY ===');
          // Redirect to the callback URL
          return NextResponse.redirect(new URL(callbackUrl, request.url));
        } else {
          console.error('Failed to create session via credentials endpoint');
          return NextResponse.redirect(new URL('/auth/error?error=SessionCreationFailed', request.url));
        }
        
      } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
      }
    } else {
      console.error('No user data provided in SSO callback');
      return NextResponse.redirect(new URL('/auth/error?error=NoUserData', request.url));
    }
    
  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=CallbackError', request.url));
  }
}
