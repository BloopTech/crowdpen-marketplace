import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Get the app URL from environment variables
const APP_URL = process.env.NEXTAUTH_URL;

/**
 * Handle Crowdpen authentication callback
 * 
 * This endpoint is called when the user is redirected back from Crowdpen
 * after a successful login. It should receive a token parameter
 * that we can use to authenticate the user in our app.
 */
export async function GET(request) {
  try {
    console.log('Crowdpen SSO callback handler activated');
    
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const state = url.searchParams.get("state");
    const returnTo = APP_URL || url.searchParams.get("returnTo");

    // If we received a token directly, set the standard NextAuth cookies server-side
    if (token) {
      const cookieStore = cookies();
      // 1. Session token
      cookieStore.set('__Secure-next-auth.session-token', token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });

      // 2. CSRF token (state)
      if (state) {
        cookieStore.set('__Host-next-auth.csrf-token', state, {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30
        });
      }

      // 3. Callback URL
      cookieStore.set('__Secure-next-auth.callback-url', returnTo, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      });

      // Redirect immediately since cookies are set
      return NextResponse.redirect(returnTo);
    }
    const error = url.searchParams.get("error");
    
    // Handle error from Crowdpen
    if (error) {
      console.error("Error from Crowdpen SSO:", error);
      const errorMessage = url.searchParams.get("error_description") || "Authentication failed";
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }
    
    // Create a client-side script to handle the token and state
    // This is necessary because we need to access localStorage which can only be done client-side
    const handleCallbackScript = `
      <html>
      <head>
        <title>Completing login...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h2 {
            color: #333;
          }
          .spinner {
            margin: 1.5rem auto;
            width: 40px;
            height: 40px;
            border: 4px solid rgba(0,0,0,0.1);
            border-radius: 50%;
            border-top-color: #000;
            animation: spin 1s ease-in-out infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          #debug {
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: left;
            max-width: 100%;
            overflow: auto;
            padding: 10px;
            background: #f9f9f9;
            border-radius: 4px;
            display: none;
          }
          #debugToggle {
            background: none;
            border: none;
            color: #999;
            cursor: pointer;
            margin-top: 10px;
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Completing your login</h2>
          <div class="spinner"></div>
          <p>Please wait while we redirect you...</p>
          <button id="debugToggle" onclick="toggleDebug()">Show debug info</button>
          <div id="debug"></div>
        </div>
        
        <script>
          // Debug logging function that shows in UI
          function logDebug(message) {
            console.log(message);
            const debugEl = document.getElementById('debug');
            if (debugEl) {
              debugEl.innerHTML += message + '<br>';
            }
          }
          
          function toggleDebug() {
            const debugEl = document.getElementById('debug');
            if (debugEl.style.display === 'none' || !debugEl.style.display) {
              debugEl.style.display = 'block';
              document.getElementById('debugToggle').textContent = 'Hide debug info';
            } else {
              debugEl.style.display = 'none';
              document.getElementById('debugToggle').textContent = 'Show debug info';
            }
          }
          
          // Function to safely get localStorage items
          function getLocalStorageItem(key) {
            try {
              return window.localStorage.getItem(key);
            } catch (e) {
              logDebug('Error accessing localStorage: ' + e);
              return null;
            }
          }

          // Get cookies for debugging
          function getCookies() {
            return document.cookie.split(';').map(cookie => cookie.trim());
          }
          
          // Get stored state and return URL
          const storedState = getLocalStorageItem('crowdpen_sso_state');
          const returnTo = getLocalStorageItem('crowdpen_sso_returnTo') || '/';
          const receivedState = "${state || ''}";
          const receivedToken = "${token || ''}";
          
          // Log initial info for debugging
          logDebug('Starting authentication completion');
          logDebug('Token received: ' + (receivedToken ? 'Yes' : 'No'));
          logDebug('State received: ' + (receivedState || 'None'));
          logDebug('State stored: ' + (storedState || 'None'));
          logDebug('Return URL: ' + returnTo);
          
          // Get all cookies for debugging
          logDebug('Current cookies: ');
          getCookies().forEach(cookie => {
            logDebug('- ' + cookie.split('=')[0]);
          });
          
          // Main function to handle authentication
          async function completeAuthentication() {
            try {
              // Clear the SSO state from localStorage
              localStorage.removeItem('crowdpen_sso_state');
              localStorage.removeItem('crowdpen_sso_returnTo');
              logDebug('Cleared SSO state from localStorage');
              
              // Validate state if present to prevent CSRF
              if (storedState && receivedState && storedState !== receivedState) {
                logDebug("State mismatch - possible CSRF attack");
                logDebug("Stored: " + storedState);
                logDebug("Received: " + receivedState);
                window.location.href = '/login?error=StateMismatch&message=Security+validation+failed';
                return;
              }
              
              // If we have a token, use it with the crowdpen provider
              if (receivedToken) {
                logDebug("Token received from Crowdpen, authenticating...");
                
                try {
                  // Try to use fetch API directly to establish a session
                  logDebug("Attempting direct session verification...");
                  const verifyResponse = await fetch('/api/auth/signin/crowdpen', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      token: receivedToken,
                      csrfToken: Math.random().toString(36).substring(2),
                      callbackUrl: returnTo,
                      json: true
                    })
                  });
                  
                  const verifyResult = await verifyResponse.json();
                  
                  if (verifyResult?.url) {
                    // Successfully authenticated
                    logDebug("Authentication successful via API, redirecting to: " + verifyResult.url);
                    window.location.href = verifyResult.url;
                    return;
                  } else {
                    // Direct verification failed, fall back to redirect method
                    logDebug("Direct verification failed, using redirect method. Error: " + 
                      (verifyResult?.error || 'Unknown error'));
                  }
                } catch (apiError) {
                  logDebug("Error during direct verification: " + apiError.message);
                  // Continue with redirect method
                }
                
                // Fall back to redirect method
                const signinUrl = window.location.origin + '/api/auth/signin/crowdpen';
                const params = new URLSearchParams({
                  token: receivedToken,
                  callbackUrl: returnTo
                });
                
                logDebug("Redirecting to: " + signinUrl + '?' + params.toString());
                window.location.href = signinUrl + '?' + params.toString();
                return;
              }
              
              // Otherwise check for active Crowdpen session through the proxy API
              logDebug("No token provided, checking for Crowdpen session...");
              const response = await fetch('/api/proxy/crowdpen-session', {
                credentials: 'include',
                headers: {
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'X-Requested-With': 'XMLHttpRequest'
                }
              });
              
              const data = await response.json();
              logDebug("Proxy response: " + JSON.stringify(data).substring(0, 100) + '...');
              
              if (data?.token) {
                // We found a session with token, proceed with login
                logDebug("Found Crowdpen session, authenticating with token: " + data.token.substring(0, 10) + '...');
                
                // Use NextAuth's signin endpoint directly 
                const signinUrl = window.location.origin + '/api/auth/signin/crowdpen';
                const params = new URLSearchParams({
                  token: data.token,
                  callbackUrl: returnTo
                });
                
                logDebug("Redirecting to: " + signinUrl + '?' + params.toString());
                window.location.href = signinUrl + '?' + params.toString();
              } else {
                // No session found - show error
                logDebug("No valid Crowdpen session found");
                window.location.href = '/login?error=NoSession&message=No+valid+Crowdpen+session+found';
              }
            } catch (error) {
              logDebug("Error during SSO completion: " + error.message);
              window.location.href = '/login?error=SSOError&message=' + 
                encodeURIComponent(error.message || "Authentication failed");
            }
          }
          
          // Execute the authentication flow
          // Add a small delay to ensure the UI renders first
          setTimeout(completeAuthentication, 500);
        </script>
      </body>
      </html>
    `;

    // Return the HTML with the script that will handle the callback client-side
    return new NextResponse(handleCallbackScript, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
    
  } catch (error) {
    console.error("Crowdpen callback error:", error.message, error.stack);
    
    // Return an error page
    const errorHtml = `
      <html>
      <head><title>Login Error</title></head>
      <body>
        <h2>Login Error</h2>
        <p>There was an error completing your login: ${error.message}</p>
        <p><a href="/login">Return to login</a></p>
      </body>
      </html>
    `;
    
    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}
