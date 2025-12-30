import { NextResponse } from "next/server";
import sequelize from "../../../models/database";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../lib/security/rateLimit";

function getSessionTokenFromCookieHeader(cookieHeader) {
  const raw = String(cookieHeader || "");
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1);
    if (name === "__Secure-next-auth.session-token" || name === "next-auth.session-token") {
      return value || null;
    }
  }
  return null;
}

/**
 * API endpoint to verify session tokens for middleware
 * This runs in Node.js runtime and can safely access the database
 */
export async function POST(request) {
  try {
    if (request.headers.get("x-cp-internal-proxy") !== "1") {
      return NextResponse.json({ isValid: false }, { status: 403 });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `verify-session:${ip}`, limit: 120, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { isValid: false },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sessionTokenRaw = body?.sessionToken;
    const sessionToken = sessionTokenRaw == null ? "" : String(sessionTokenRaw);

    const cookieToken = getSessionTokenFromCookieHeader(request.headers.get("cookie"));
    if (!cookieToken || sessionToken !== String(cookieToken)) {
      return NextResponse.json({ isValid: false }, { status: 200 });
    }

    if (!sessionToken || sessionToken.length > 256) {
      return NextResponse.json({ isValid: false }, { status: 400 });
    }

    // Verify the session token with the database
    const [results] = await sequelize.query(
      `SELECT s."session_token",
              s."expires",
              s."user_id",
              u."id" as "userExists",
              u."role" as "userRole",
              u."crowdpen_staff" as "crowdpenStaff"
       FROM "sessions" s
       LEFT JOIN "users" u ON s."user_id" = u."id"
       WHERE s."session_token" = :sessionToken
       AND s."expires" > NOW()`,
      {
        replacements: { sessionToken },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    //console.log("results server............................", results)

    // Check if we found a valid, non-expired session with an existing user
    const isValid = !!(results && results.userExists);

    return NextResponse.json({
      isValid,
      userId: isValid ? results.user_id : null,
      user: isValid
        ? {
            id: results.user_id,
            role: results.userRole,
            crowdpen_staff: results.crowdpenStaff,
          }
        : null,
    });
  } catch (error) {
    console.error("Error verifying session:", error);
    // On database error, return false for security
    return NextResponse.json({ isValid: false }, { status: 500 });
  }
}
