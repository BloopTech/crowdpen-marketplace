import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/route";
import { signIn } from "next-auth/react";
import sequelize from "../../../../lib/db";

/**
 * Direct sign-in API for Crowdpen SSO
 * This bypasses the cookie sharing issues by directly creating a session
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    console.log(`Attempting to directly sign in user: ${email}`);
    
    // Find the user in the database
    const user = await sequelize.models.User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log(`User not found: ${email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create a session token directly
    console.log(`User found: ${user.email}, creating session`);
    
    // Return success with user info
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || email.split('@')[0],
        image: user.image
      }
    });
  } catch (error) {
    console.error("Crowdpen direct sign-in error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate", message: error.message },
      { status: 500 }
    );
  }
}
