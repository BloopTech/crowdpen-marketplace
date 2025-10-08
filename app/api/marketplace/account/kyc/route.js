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

    const kyc = await db.MarketplaceKycVerification.findOne({
      where: { user_id: userId },
    });

    return NextResponse.json({
      status: "success",
      kyc: kyc ? kyc : null,
    });
  } catch (error) {
    console.error("KYC GET error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to fetch KYC" },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user?.id) {
    //   return NextResponse.json(
    //     { status: "error", message: "Authentication required" },
    //     { status: 401 }
    //   );
    // }

    // const userId = session.user.id;
    const body = await request.json();

    const payload = {
      user_id: body.userId,
      status: body.status || "pending",
      level: body.level || "standard",
      first_name: body.first_name,
      last_name: body.last_name,
      middle_name: body.middle_name,
      phone_number: body.phone_number,
      dob: body.dob ? new Date(body.dob) : null,
      nationality: body.nationality,
      address_line1: body.address_line1,
      address_line2: body.address_line2,
      city: body.city,
      state: body.state,
      postal_code: body.postal_code,
      country: body.country,
      id_type: body.id_type,
      id_number: body.id_number,
      id_country: body.id_country,
      id_expiry: body.id_expiry ? new Date(body.id_expiry) : null,
      id_front_url: body.id_front_url,
      id_back_url: body.id_back_url,
      selfie_url: body.selfie_url,
      provider: body.provider || null,
      metadata: body.metadata || null,
    };

    const existing = await db.MarketplaceKycVerification.findOne({
      where: { user_id: body.userId },
    });
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
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to upsert KYC" },
      { status: 500 }
    );
  }
}
