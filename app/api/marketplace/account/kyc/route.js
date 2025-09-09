import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";

async function ensureKycSynced() {
  try {
    if (db?.KycVerification?.sync) {
      await db.KycVerification.sync();
    }
  } catch (e) {
    console.error("KYC sync error (non-fatal):", e?.message || e);
  }
}

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
    await ensureKycSynced();

    const kyc = await db.KycVerification.findOne({ where: { user_id: userId } });

    return NextResponse.json({
      status: "success",
      kyc: kyc
        ? {
            id: kyc.id,
            status: kyc.status,
            level: kyc.level,
            first_name: kyc.first_name,
            last_name: kyc.last_name,
            middle_name: kyc.middle_name,
            phone_number: kyc.phone_number,
            dob: kyc.dob,
            nationality: kyc.nationality,
            address_line1: kyc.address_line1,
            address_line2: kyc.address_line2,
            city: kyc.city,
            state: kyc.state,
            postal_code: kyc.postal_code,
            country: kyc.country,
            id_type: kyc.id_type,
            id_number: kyc.id_number,
            id_country: kyc.id_country,
            id_expiry: kyc.id_expiry,
            id_front_url: kyc.id_front_url,
            id_back_url: kyc.id_back_url,
            selfie_url: kyc.selfie_url,
            rejection_reason: kyc.rejection_reason,
            reviewed_by: kyc.reviewed_by,
            reviewed_at: kyc.reviewed_at,
            submitted_at: kyc.submitted_at,
            provider: kyc.provider,
            metadata: kyc.metadata,
          }
        : null,
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
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    await ensureKycSynced();
    const body = await request.json();

    const payload = {
      user_id: userId,
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

    const existing = await db.KycVerification.findOne({ where: { user_id: userId } });
    let record;
    if (existing) {
      await existing.update(payload);
      record = existing;
    } else {
      record = await db.KycVerification.create({ ...payload, submitted_at: new Date() });
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
