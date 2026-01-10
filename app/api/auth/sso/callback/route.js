import { NextResponse } from 'next/server';
import { handleUserData } from '../../[...nextauth]/route';
import { getRequestIdFromHeaders, reportError } from '../../../../lib/observability/reportError';

export const runtime = "nodejs";

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
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let providerParam = null;
  let callbackUrl = "/";
  let userPresent = false;
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user'); // User data passed as JSON string from Crowdpen
    const provider = searchParams.get('provider'); // Provider used on Crowdpen (email/github/google)
    const callbackUrlRaw = searchParams.get('callbackUrl') || '/';
    callbackUrl = typeof callbackUrlRaw === 'string' && callbackUrlRaw.startsWith('/')
      ? callbackUrlRaw
      : '/';

    providerParam = provider || null;
    userPresent = Boolean(user);

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
          await reportError(new Error("Invalid user data - missing email"), {
            route: "/api/auth/sso/callback",
            method: "GET",
            status: 400,
            requestId,
            tag: "sso_callback",
            extra: {
              stage: "missing_email",
              provider: providerParam,
              callbackUrl,
              userPresent,
            },
          });
          return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
        }
        
        // Validate user exists in database
        if (!isProd) {
          console.log('=== VALIDATING USER EXISTS IN DATABASE ===');
        }
        const dbUser = await handleUserData(JSON.stringify(userData));
        
        if (!dbUser) {
          await reportError(new Error("User not found in database"), {
            route: "/api/auth/sso/callback",
            method: "GET",
            status: 404,
            requestId,
            tag: "sso_callback",
            extra: {
              stage: "user_not_found",
              provider: providerParam,
              callbackUrl,
              userPresent,
            },
          });
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
        await reportError(parseError, {
          route: "/api/auth/sso/callback",
          method: "GET",
          status: 400,
          requestId,
          tag: "sso_callback",
          extra: {
            stage: "parse_user_data",
            provider: providerParam,
            callbackUrl,
            userPresent,
          },
        });
        return NextResponse.redirect(new URL('/auth/error?error=InvalidUserData', request.url));
      }
    } else {
      if (!user) {
        await reportError(new Error("No user data provided in SSO callback"), {
          route: "/api/auth/sso/callback",
          method: "GET",
          status: 400,
          requestId,
          tag: "sso_callback",
          extra: {
            stage: "missing_user",
            provider: providerParam,
            callbackUrl,
            userPresent,
          },
        });
        return NextResponse.redirect(new URL('/auth/error?error=NoUserData', request.url));
      }
      if (!provider) {
        await reportError(new Error("No provider specified in SSO callback"), {
          route: "/api/auth/sso/callback",
          method: "GET",
          status: 400,
          requestId,
          tag: "sso_callback",
          extra: {
            stage: "missing_provider",
            provider: providerParam,
            callbackUrl,
            userPresent,
          },
        });
        return NextResponse.redirect(new URL('/auth/error?error=NoProvider', request.url));
      }
    }
    
  } catch (error) {
    await reportError(error, {
      route: "/api/auth/sso/callback",
      method: "GET",
      status: 500,
      requestId,
      tag: "sso_callback",
      extra: {
        stage: "unhandled",
        provider: providerParam,
        callbackUrl,
        userPresent,
      },
    });
    return NextResponse.redirect(new URL('/auth/error?error=CallbackError', request.url));
  }
}
