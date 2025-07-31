import { NextResponse } from 'next/server';
import { handleUserData } from '../../[...nextauth]/route';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../[...nextauth]/route';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user'); // User data passed as JSON string from Crowdpen
    const provider = searchParams.get('provider'); // Provider used on Crowdpen (email/github/google)
    const callbackUrl = searchParams.get('callbackUrl') || '/';
    
    console.log('=== SSO CALLBACK RECEIVED ===');
    console.log('SSO callback params:', { 
      user: user ? 'present' : 'missing',
      provider: provider || 'not specified',
      callbackUrl 
    });
    
    if (user && provider) {
      try {
        const userData = JSON.parse(decodeURIComponent(user));
        console.log('Parsed user data for:', userData.email, 'with provider:', provider);
        
        // Validate user data
        if (!userData.email) {
          console.error('Invalid user data - missing email');
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }
        
        // Validate user exists in database
        console.log('=== VALIDATING USER EXISTS IN DATABASE ===');
        const dbUser = await handleUserData(JSON.stringify(userData));
        
        if (!dbUser) {
          console.error('User not found in database - must sign up on Crowdpen first');
          return NextResponse.redirect(new URL('/auth/error?error=UserNotFound', request.url));
        }
        
        console.log('=== DATABASE USER VALIDATED ===');
        console.log('User ID:', dbUser.id, 'Email:', dbUser.email);
        
        // Handle different providers differently
        if (provider === 'email') {
          // For email provider, use crowdpen-sso credentials since user is already authenticated
          console.log('=== REDIRECTING TO SSO SIGNIN FOR EMAIL PROVIDER ===');
          const signInUrl = new URL('/auth/sso-signin', request.url);
          signInUrl.searchParams.set('userData', JSON.stringify(userData));
          signInUrl.searchParams.set('callbackUrl', callbackUrl);
          return NextResponse.redirect(signInUrl);
        } else {
          // For OAuth providers (GitHub, Google), redirect to provider-specific sign-in page
          console.log('=== REDIRECTING TO PROVIDER SIGNIN PAGE ===');
          const signInUrl = new URL('/auth/provider-signin', request.url);
          signInUrl.searchParams.set('email', userData.email);
          signInUrl.searchParams.set('provider', provider);
          signInUrl.searchParams.set('callbackUrl', callbackUrl);
          return NextResponse.redirect(signInUrl);
        }
        
      } catch (parseError) {
        console.error('Failed to parse user data:', parseError);
        return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
      }
    } else {
      if (!user) {
        console.error('No user data provided in SSO callback');
        return NextResponse.redirect(new URL('/auth/error?error=NoUserData', request.url));
      }
      if (!provider) {
        console.error('No provider specified in SSO callback');
        return NextResponse.redirect(new URL('/auth/error?error=NoProvider', request.url));
      }
    }
    
  } catch (error) {
    console.error('SSO callback error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=CallbackError', request.url));
  }
}
