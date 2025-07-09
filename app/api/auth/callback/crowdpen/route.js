import { NextResponse } from "next/server";

/**
 * Handle Crowdpen authentication callback
 * 
 * This endpoint is called when the user is redirected back from Crowdpen
 * after a successful login. It should receive a token or email parameter
 * that we can use to authenticate the user in our app.
 */
export async function GET(request) {
  try {
    console.log('Crowdpen SSO callback handler activated');
    
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    const token = url.searchParams.get("token");
    const state = url.searchParams.get("state");
    
    // Create a client-side script to handle the token and state
    // This is necessary because we need to access localStorage which can only be done client-side
    const handleCallbackScript = `
      <html>
      <head><title>Completing login...</title></head>
      <body>
        <h2>Completing your login...</h2>
        <p>Please wait while we redirect you...</p>
        <script>
          // Function to safely get localStorage items
          function getLocalStorageItem(key) {
            try {
              return window.localStorage.getItem(key);
            } catch (e) {
              console.error('Error accessing localStorage:', e);
              return null;
            }
          }
          
          // Get stored state and return URL
          const storedState = getLocalStorageItem('crowdpen_sso_state');
          const returnTo = getLocalStorageItem('crowdpen_sso_returnTo') || '/';
          const receivedState = "${state || ''}";
          const receivedEmail = "${email || ''}";
          
          // Main function to handle authentication
          async function completeAuthentication() {
            try {
              // Clear the SSO state from localStorage
              localStorage.removeItem('crowdpen_sso_state');
              localStorage.removeItem('crowdpen_sso_returnTo');
              
              // If we have an email directly, use it
              if (receivedEmail) {
                console.log("Email received from Crowdpen:", receivedEmail);
                window.location.href = '/api/auth/signin/credentials?email=' + 
                  encodeURIComponent(receivedEmail) + '&callbackUrl=' + 
                  encodeURIComponent(returnTo);
                return;
              }
              
              // Otherwise check for session through the proxy API
              console.log("Checking for Crowdpen session...");
              const response = await fetch('/api/proxy/crowdpen-session', {
                credentials: 'include',
                cache: 'no-store'
              });
              
              const data = await response.json();
              
              if (data?.user?.email) {
                // We found a user email, proceed with login
                console.log("Found user email from session:", data.user.email);
                window.location.href = '/api/auth/signin/credentials?email=' + 
                  encodeURIComponent(data.user.email) + '&callbackUrl=' + 
                  encodeURIComponent(returnTo);
              } else {
                // No session found - show error
                console.error("No valid Crowdpen session or email found");
                window.location.href = '/login?error=NoSession&message=No+valid+Crowdpen+session+found';
              }
            } catch (error) {
              console.error("Error during SSO completion:", error);
              window.location.href = '/login?error=SSOError&message=' + 
                encodeURIComponent(error.message);
            }
          }
          
          // Execute the authentication flow
          completeAuthentication();
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
