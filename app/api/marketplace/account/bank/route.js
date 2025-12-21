import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

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
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to fetch bank" },
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
    const body = await request.json();

    const payload = {
      user_id: userId,
      payout_type: body.payout_type || "bank",
      currency: body.currency,
      country_code: body.country_code || null,
      bank_code: body.bank_code || null,
      bank_name: body.bank_name || null,
      bank_id: body.bank_id || null,
      account_name: body.account_name || null,
      msisdn: body.msisdn || null,
      verified: !!body.verified,
    };

    // account_number is virtual setter to encrypt
    if (body.account_number) {
      payload.account_number = String(body.account_number);
    }

    let record = await db.MarketplaceMerchantBank.findOne({
      where: { user_id: userId },
    });
    if (record) {
      await record.update(payload);
    } else {
      record = await db.MarketplaceMerchantBank.create(payload);
    }

    return NextResponse.json({ status: "success", id: record.id });
  } catch (error) {
    console.error("Bank PATCH error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to upsert bank" },
      { status: 500 }
    );
  }
}
