import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

// PATCH /api/marketplace/account/settings
// Updates user account settings
export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();

    // Valid setting keys
    const validKeys = [
      'newProductNotifications',
      'weeklyNewsletter',
      'marketingEmails',
      'publicPurchases',
      'publicWishlist',
    ];

    // Filter to only valid keys
    const updates = {};
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: "error", message: "No valid settings provided" },
        { status: 400 }
      );
    }

    // Find or create user settings
    const user = await db.User.findByPk(userId);
    if (!user) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    // Get current settings or default
    const currentSettings = user.settings || {};
    const newSettings = { ...currentSettings, ...updates };

    // Update user settings
    await user.update({ settings: newSettings });

    return NextResponse.json({
      status: "success",
      message: "Settings updated",
      settings: newSettings,
    });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to update settings" },
      { status: 500 }
    );
  }
}

// GET /api/marketplace/account/settings
// Returns user account settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const user = await db.User.findByPk(userId, {
      attributes: ['settings'],
    });

    if (!user) {
      return NextResponse.json(
        { status: "error", message: "User not found" },
        { status: 404 }
      );
    }

    // Return settings with defaults
    const settings = {
      newProductNotifications: true,
      weeklyNewsletter: true,
      marketingEmails: false,
      publicPurchases: true,
      publicWishlist: false,
      ...(user.settings || {}),
    };

    return NextResponse.json({
      status: "success",
      settings,
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
