import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";

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

    const user = await db.User.findOne({
      where: { id: userId },
      attributes: ["id", "role", "crowdpen_staff"],
      raw: true,
    });
    const kycExempt = db.User.isKycExempt(user);

    const kyc = await db.MarketplaceKycVerification.findOne({
      where: { user_id: userId },
    });

    return NextResponse.json({
      status: "success",
      kyc: kyc ? kyc : null,
      kycExempt,
    });
  } catch (error) {
    console.error("KYC GET error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to fetch KYC" : (error?.message || "Failed to fetch KYC"),
      },
      { status: 500 }
    );
  }
}

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

    const user = await db.User.findOne({
      where: { id: userId },
      attributes: ["id", "role", "crowdpen_staff"],
      raw: true,
    });
    if (db.User.isKycExempt(user)) {
      return NextResponse.json({
        status: "success",
        message: "KYC not required",
        kycId: null,
      });
    }

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `account-kyc:${String(userId)}:${ip}`, limit: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));

    const parseDate = (v) => {
      if (v == null || v === "") return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d;
    };

    const dob = body.dob != null && body.dob !== "" ? parseDate(body.dob) : null;
    if (body.dob != null && body.dob !== "" && !dob) {
      return NextResponse.json(
        { status: "error", message: "Invalid dob" },
        { status: 400 }
      );
    }

    const idExpiry = body.id_expiry != null && body.id_expiry !== "" ? parseDate(body.id_expiry) : null;
    if (body.id_expiry != null && body.id_expiry !== "" && !idExpiry) {
      return NextResponse.json(
        { status: "error", message: "Invalid id_expiry" },
        { status: 400 }
      );
    }

    const levelRaw = String(body.level || "standard").toLowerCase();
    const level = ["basic", "standard", "enhanced"].includes(levelRaw)
      ? levelRaw
      : "standard";

    const existing = await db.MarketplaceKycVerification.findOne({
      where: { user_id: userId },
    });

    const payload = {
      user_id: userId,
      status: "pending",
      level,
      first_name: body.first_name == null ? null : String(body.first_name).slice(0, 100),
      last_name: body.last_name == null ? null : String(body.last_name).slice(0, 100),
      middle_name: body.middle_name == null ? null : String(body.middle_name).slice(0, 100),
      phone_number: body.phone_number == null ? null : String(body.phone_number).slice(0, 40),
      dob,
      nationality: body.nationality == null ? null : String(body.nationality).slice(0, 80),
      address_line1: body.address_line1 == null ? null : String(body.address_line1).slice(0, 255),
      address_line2: body.address_line2 == null ? null : String(body.address_line2).slice(0, 255),
      city: body.city == null ? null : String(body.city).slice(0, 120),
      state: body.state == null ? null : String(body.state).slice(0, 120),
      postal_code: body.postal_code == null ? null : String(body.postal_code).slice(0, 40),
      country: body.country == null ? null : String(body.country).slice(0, 80),
      id_type: body.id_type == null ? null : String(body.id_type).slice(0, 40),
      id_number: body.id_number == null ? null : String(body.id_number).slice(0, 80),
      id_country: body.id_country == null ? null : String(body.id_country).slice(0, 80),
      id_expiry: idExpiry,
      id_front_url: body.id_front_url == null ? null : String(body.id_front_url).slice(0, 2000),
      id_back_url: body.id_back_url == null ? null : String(body.id_back_url).slice(0, 2000),
      selfie_url: body.selfie_url == null ? null : String(body.selfie_url).slice(0, 2000),
      provider: body.provider == null ? null : String(body.provider).slice(0, 80),
      metadata: body.metadata || null,
    };
    let record;
    if (existing) {
      await existing.update(payload);
      record = existing;
    } else {
      record = await db.MarketplaceKycVerification.create({
        ...payload,
        submitted_at: new Date(),
      });
    }

    return NextResponse.json({
      status: "success",
      message: existing ? "KYC updated" : "KYC submitted",
      kycId: record.id,
    });
  } catch (error) {
    console.error("KYC PATCH error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to upsert KYC" : (error?.message || "Failed to upsert KYC"),
      },
      { status: 500 }
    );
  }
}
