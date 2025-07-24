import { NextResponse } from "next/server";
import sequelize from "../../../models/database";

/**
 * API endpoint to verify session tokens for middleware
 * This runs in Node.js runtime and can safely access the database
 */
export async function POST(request) {
  try {
    const { sessionToken } = await request.json();

    if (!sessionToken) {
      return NextResponse.json({ isValid: false }, { status: 400 });
    }

    // Verify the session token with the database
    const [results] = await sequelize.query(
      `SELECT s."session_token", s."expires", s."user_id", u."id" as "userExists"
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
    const isValid = results && results.userExists;

    return NextResponse.json({
      isValid,
      userId: isValid ? results.user_id : null,
    });
  } catch (error) {
    console.error("Error verifying session:", error);
    // On database error, return false for security
    return NextResponse.json({ isValid: false }, { status: 500 });
  }
}
