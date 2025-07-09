import { NextResponse } from "next/server";
import sequelize from "../../../models";
import crypto from "crypto";

/**
 * Verifies a secure token and returns the associated user if valid
 * This API is used as part of the SSO flow between Crowdpen and the marketplace
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;
    
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    
    console.log(`Verifying token for SSO authentication...`);
    
    // Find the token in the database - assuming there's a UserToken model or similar
    // that stores temporary authentication tokens shared between Crowdpen and marketplace
    // This is a simplified implementation - in production you'd want to use proper JWT or similar
    const userToken = await sequelize.models.VerificationToken.findOne({
      where: { token },
      include: [{
        model: sequelize.models.User,
        as: 'user'
      }]
    });
    
    if (!userToken || userToken.expiresAt < new Date()) {
      console.log(`Invalid or expired token`);
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    
    const user = userToken.user;
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    console.log(`Valid token for user: ${user.email}`);
    
    // Return the user info to be used for signing in
    return NextResponse.json({
      verified: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      }
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify token", message: error.message },
      { status: 500 }
    );
  }
}
