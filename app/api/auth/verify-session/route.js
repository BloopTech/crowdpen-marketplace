import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../[...nextauth]/route";
import jwt from "jsonwebtoken";

/**
 * Verifies a session and returns user data if valid
 * This endpoint should be implemented on both Crowdpen and Marketplace
 * It allows secure session verification between the two apps
 */
export async function POST(request) {
  try {
    // Get the current session from NextAuth
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log("No active session found");
      return NextResponse.json({ error: "No active session" }, { status: 401 });
    }
    
    // Create a short-lived token with user data
    // This token will be used by the other application to create an equivalent session
    const token = jwt.sign(
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image || null,
        // Add other necessary user fields here
      },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: "5m" } // Short expiration for security
    );
    
    return NextResponse.json({
      user: session.user,
      token
    });
  } catch (error) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
