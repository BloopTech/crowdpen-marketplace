/**
 * Check if a user is authenticated in middleware context
 * Uses Edge Runtime-compatible session verification via API call
 * @param {Request} request - Next.js request object
 * @returns {Promise<boolean>} - Whether the user is authenticated
 */
export async function isAuthenticatedInMiddleware(request) {
  try {
    // Get session token from cookies
    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value;
    console.log("token........................", sessionToken);
    if (!sessionToken) {
      return false;
    }

    // For Edge Runtime compatibility, we'll make an internal API call
    // to verify the session instead of direct database access
    const baseUrl = process.env.NEXTAUTH_URL;
    const verifyUrl = new URL("/api/auth/verify-session", baseUrl).toString();

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ sessionToken }),
    });
    //console.log("response agao............................", response)
    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    //console.log("result again............................", result)
    const isValid = result.isValid;
    return !!isValid;
  } catch (error) {
    console.error("Error checking authentication in middleware:", error);
    // On error, fall back to false for security
    return false;
  }
}
