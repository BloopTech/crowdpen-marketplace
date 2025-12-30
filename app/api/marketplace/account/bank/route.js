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
    const record = await db.MarketplaceMerchantBank.findOne({
      where: { user_id: userId },
    });

    if (!record) {
      return NextResponse.json({ status: "success", bank: null });
    }

    const bank = {
      id: record.id,
      payout_type: record.payout_type,
      currency: record.currency,
      country_code: record.country_code,
      bank_code: record.bank_code,
      bank_name: record.bank_name,
      bank_id: record.bank_id,
      account_name: record.account_name,
      account_number_last4: record.account_number_last4,
      msisdn: record.msisdn,
      verified: !!record.verified,
      updatedAt: record.updatedAt,
      createdAt: record.createdAt,
    };

    return NextResponse.json({ status: "success", bank });
  } catch (error) {
    console.error("Bank GET error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to fetch bank" : (error?.message || "Failed to fetch bank"),
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

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `account-bank:${String(userId)}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));

    let record = await db.MarketplaceMerchantBank.findOne({
      where: { user_id: userId },
    });

    const payload = {
      user_id: userId,
      payout_type: String(body.payout_type || "bank").slice(0, 40),
      currency: body.currency == null ? null : String(body.currency).slice(0, 10),
      country_code: body.country_code == null ? null : String(body.country_code).slice(0, 10),
      bank_code: body.bank_code == null ? null : String(body.bank_code).slice(0, 100),
      bank_name: body.bank_name == null ? null : String(body.bank_name).slice(0, 200),
      bank_id: body.bank_id == null ? null : String(body.bank_id).slice(0, 100),
      account_name: body.account_name == null ? null : String(body.account_name).slice(0, 200),
      msisdn: body.msisdn == null ? null : String(body.msisdn).slice(0, 40),
      verified: record ? !!record.verified : false,
    };

    // account_number is virtual setter to encrypt
    if (body.account_number) {
      payload.account_number = String(body.account_number).slice(0, 128);
    }

    if (record) {
      await record.update(payload);
    } else {
      record = await db.MarketplaceMerchantBank.create(payload);
    }

    return NextResponse.json({ status: "success", id: record.id });
  } catch (error) {
    console.error("Bank PATCH error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        status: "error",
        message: isProd ? "Failed to upsert bank" : (error?.message || "Failed to upsert bank"),
      },
      { status: 500 }
    );
  }
}
