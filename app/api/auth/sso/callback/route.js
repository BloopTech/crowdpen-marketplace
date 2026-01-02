import { NextResponse } from 'next/server';
import { handleUserData } from '../../[...nextauth]/route';

function normalizeSha256SignatureToHex(sig) {
  const sigText = String(sig || "").trim();
  if (!sigText) return null;

  const hexMatch = sigText.match(/^(?:sha256=)?([0-9a-f]{64})$/i);
  if (hexMatch && hexMatch[1]) return String(hexMatch[1]).toLowerCase();

  const rawText = sigText.startsWith("sha256=") ? sigText.slice("sha256=".length) : sigText;
  const raw = rawText.replace(/ /g, "+");
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

  try {
    const buf = Buffer.from(padded, "base64");
    if (buf.length !== 32) return null;
    return buf.toString("hex");
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user'); // User data passed as JSON string from Crowdpen
    const provider = searchParams.get('provider'); // Provider used on Crowdpen (email/github/google)
    const callbackUrlRaw = searchParams.get('callbackUrl') || '/';
    const callbackUrl = typeof callbackUrlRaw === 'string' && callbackUrlRaw.startsWith('/')
      ? callbackUrlRaw
      : '/';

    const ts = searchParams.get('ts') || searchParams.get('timestamp') || searchParams.get('t');
    const sig = searchParams.get('sig') || searchParams.get('signature');

    const isProd = process.env.NODE_ENV === "production";

    const invalidSsoRedirect = (reason) => {
      const errUrl = new URL('/auth/error', request.url);
      errUrl.searchParams.set('error', 'InvalidSSO');
      if (reason) errUrl.searchParams.set('reason', String(reason).slice(0, 64));
      return NextResponse.redirect(errUrl);
    };

    if (!isProd) {
      console.log('=== SSO CALLBACK RECEIVED ===');
      console.log('SSO callback params:', {
        user: user ? 'present' : 'missing',
        provider: provider || 'not specified',
        callbackUrl,
      });
    }
    
    if (user && provider) {
      try {
        const providerNormalized = String(provider).toLowerCase();
        if (!['email', 'github', 'google'].includes(providerNormalized)) {
          return NextResponse.redirect(new URL('/auth/error?error=NoProvider', request.url));
        }

        if (typeof user === 'string' && user.length > 20000) {
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }

        const decodedUserText = decodeURIComponent(user);
        const userData = JSON.parse(decodedUserText);
        if (!isProd) {
          console.log('Parsed user data for provider:', providerNormalized);
        }
        
        // Validate user data
        if (!userData.email) {
          console.error('Invalid user data - missing email');
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }
        
        // Validate user exists in database
        if (!isProd) {
          console.log('=== VALIDATING USER EXISTS IN DATABASE ===');
        }
        const dbUser = await handleUserData(JSON.stringify(userData));
        
        if (!dbUser) {
          console.error('User not found in database - must sign up on Crowdpen first');
          return NextResponse.redirect(new URL('/auth/error?error=UserNotFound', request.url));
        }
        
        if (!isProd) {
          console.log('=== DATABASE USER VALIDATED ===');
        }
        
        // Handle different providers differently
        if (providerNormalized === 'email') {
          if (isProd) {
            const tsText = String(ts || "").trim();
            if (!tsText) {
              return invalidSsoRedirect('missing_ts');
            }
            const tsNum = Number.parseInt(tsText, 10);
            if (!Number.isFinite(tsNum)) {
              return invalidSsoRedirect('invalid_ts');
            }

            const sigTextRaw = String(sig || "").trim();
            if (!sigTextRaw) {
              return invalidSsoRedirect('missing_sig');
            }

            const sigHex = normalizeSha256SignatureToHex(sigTextRaw);
            if (!sigHex) {
              return invalidSsoRedirect('invalid_sig');
            }
          }

          // For email provider, use crowdpen-sso credentials since user is already authenticated
          if (!isProd) {
            console.log('=== REDIRECTING TO SSO SIGNIN FOR EMAIL PROVIDER ===');
          }
          const signInUrl = new URL('/auth/sso-signin', request.url);
          signInUrl.searchParams.set('userData', decodedUserText);
          signInUrl.searchParams.set('callbackUrl', callbackUrl);
          if (ts) signInUrl.searchParams.set('ts', String(ts).slice(0, 30));
          if (sig) {
            const sigHex = normalizeSha256SignatureToHex(sig);
            signInUrl.searchParams.set('sig', String(sigHex || sig).slice(0, 256));
          }
          return NextResponse.redirect(signInUrl);
        } else {
          // For OAuth providers (GitHub, Google), redirect to provider-specific sign-in page
          if (!isProd) {
            console.log('=== REDIRECTING TO PROVIDER SIGNIN PAGE ===');
          }
          const signInUrl = new URL('/auth/provider-signin', request.url);
          signInUrl.searchParams.set('email', userData.email);
          signInUrl.searchParams.set('provider', providerNormalized);
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
