import { NextResponse } from "next/server";
import { db } from "../../../../../models/index";
import {
  getRequestIdFromHeaders,
  reportError,
} from "../../../../../lib/observability/reportError";

const { User } = db;

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let getParams = null;
  try {
    getParams = await params;
  } catch {
    getParams = null;
  }
  const { pen_name } = getParams || {};
  const penNameRaw = pen_name == null ? "" : String(pen_name).trim();

  if (!penNameRaw || penNameRaw.length > 80) {
    return NextResponse.json(
      {
        status: "error",
        message: "Author not found",
      },
      { status: 404 }
    );
  }

  try {
    // Find author with comprehensive data
    const author = await User.findOne({
      where: {
        pen_name: penNameRaw,
      },
      attributes: [
        "id",
        "name",
        "pen_name",
        "email",
        "image",
        "cover_image",
        "creator",
        "verification_badge",
        "subscribed",
        "createdAt",
        "description",
        "description_other",
        "created_date",
        "residence",
        "color",
        "lastLoginDate",
        "merchant",
      ]
    });

    if (!author) {
      return NextResponse.json(
        {
          status: "error",
          message: "Author not found",
        },
        { status: 404 }
      );
    }

    // Format author data
    const authorData = {
      id: author.id,
      name: author.name,
      pen_name: author.pen_name,
      email: author.email,
      image: author.image,
      cover_image: author.cover_image,
      color: author.color,
      residence: author.residence || "Remote",
      bio: author.description || author.description_other,
      website: author.website || "",
      social: {
        twitter: author.twitter || "",
        linkedin: author.linkedin || "",
        instagram: author.instagram || "",
      },
      verification_badge: author.verification_badge,
      creator: author.creator,
      merchant: author?.merchant,
      subscribed: author.subscribed,
      joinDate: author.created_date,
      lastLoginDate: author.lastLoginDate,
    };

    return NextResponse.json({
      status: "success",
      message: "Author found",
      author: authorData,
    });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/author/[pen_name]/meta",
      method: "GET",
      status: 500,
      requestId,
      tag: "marketplace_author_meta_get",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd
          ? "Failed to fetch author meta"
          : error?.message || "Failed to fetch author meta",
      },
      { status: 500 }
    );
  }
}
