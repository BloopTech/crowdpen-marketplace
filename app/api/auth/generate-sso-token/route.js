import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/route";
import crypto from "crypto";
import sequelize from "../../../models";

/**
 * Generates a temporary SSO token for the current user
 * This token can be used for redirecting between Crowdpen and the marketplace
 */
export async function GET(request) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    // Store the token in the database (in a table that both Crowdpen and marketplace can access)
    // Note: You'll need to create this table in your shared database
    await sequelize.query(`
      INSERT INTO sso_tokens (token, email, expires_at, created_at, updated_at)
      VALUES (:token, :email, :expiresAt, NOW(), NOW())
    `, {
      replacements: {
        token,
        email: session.user.email,
        expiresAt
      },
      type: sequelize.QueryTypes.INSERT
    });
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Error generating SSO token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
