import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "../../../../models/index";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { assertSafeExternalUrl } from "../../../../lib/security/ssrf";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

const getBaseUrl = () =>
  process.env.STARTBUTTON_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.startbutton.tech"
    : "https://api.startbutton.tech");

const ALLOWED_STARTBUTTON_HOSTS = new Set([
  "api.startbutton.tech",
  "api-dev.startbutton.tech",
]);

const getSecret = () =>
  process.env.STARTBUTTON_SECRET_KEY ||
  process.env.STARTBUTTON_SECRET ||
  process.env.STARTBUTTON_API_KEY ||
  "";

async function verifyBankAccount({ bankCode, accountNumber, countryCode }) {
  const base = getBaseUrl();
  const secret = getSecret();
  if (!secret) {
    return { ok: false, error: "Startbutton secret not configured" };
  }

  const qs = new URLSearchParams();
  qs.set("bankCode", String(bankCode || ""));
  qs.set("accountNumber", String(accountNumber || ""));
  if (countryCode) qs.set("countryCode", String(countryCode));

  const upstreamUrl = `${base}/bank/verify?${qs.toString()}`;

  let safeUpstream;
  try {
    const baseHost = new URL(base).hostname.toLowerCase();
    if (!ALLOWED_STARTBUTTON_HOSTS.has(baseHost)) {
      throw new Error("Invalid upstream");
    }
    safeUpstream = await assertSafeExternalUrl(upstreamUrl, {
      allowedHosts: [baseHost],
    });
  } catch {
    return { ok: false, error: "Upstream not available" };
  }

  const upstream = await fetch(safeUpstream.toString(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.success === false) {
    return { ok: false, error: data?.message || "Verification failed" };
  }
  const accountName = data?.data?.account_name;
  if (!accountName) {
    return { ok: false, error: "Account name not resolved" };
  }
  return {
    ok: true,
    data: {
      account_name: String(accountName),
      account_number: data?.data?.account_number,
      bank_id: data?.data?.bank_id,
    },
  };
}

export async function GET(request) {
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
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
    await reportError(error, {
      route: "/api/marketplace/account/bank",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "account_bank_get",
    });
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
  const requestId = getRequestIdFromHeaders(request?.headers) || null;
  let session = null;
  try {
    session = await getServerSession(authOptions);
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

    const safeStr = (v, max) => {
      if (v == null) return null;
      const s = String(v);
      const trimmed = s.trim();
      if (!trimmed) return null;
      return trimmed.slice(0, max);
    };

    const safeBool = (v) => v === true || v === "true";

    const payload = {
      user_id: userId,
      payout_type: safeStr(body.payout_type || "bank", 40) || "bank",
      currency: safeStr(body.currency, 10),
      country_code: safeStr(body.country_code, 10),
      bank_code: safeStr(body.bank_code, 100),
      bank_name: safeStr(body.bank_name, 200),
      bank_id: safeStr(body.bank_id, 100),
      account_name: safeStr(body.account_name, 200),
      msisdn: safeStr(body.msisdn, 40),
      verified: false,
    };

    if (!payload.currency) {
      return NextResponse.json(
        { status: "error", message: "currency is required" },
        { status: 400 }
      );
    }

    const previous = record
      ? {
          payout_type: record.payout_type,
          currency: record.currency,
          country_code: record.country_code,
          bank_code: record.bank_code,
          bank_id: record.bank_id,
          bank_name: record.bank_name,
          msisdn: record.msisdn,
          verified: !!record.verified,
          account_name: record.account_name,
        }
      : null;

    // account_number is virtual setter to encrypt
    if (body.account_number) {
      payload.account_number = safeStr(body.account_number, 128);
    }

    const payoutType = String(payload.payout_type || "bank").toLowerCase();
    const currency = String(payload.currency || "").toUpperCase();
    const userRequestedVerify = safeBool(body.verified);

    if (payoutType === "bank") {
      if (!payload.bank_code) {
        return NextResponse.json(
          { status: "error", message: "bank_code is required" },
          { status: 400 }
        );
      }
      if (!record && !payload.account_number) {
        return NextResponse.json(
          { status: "error", message: "account_number is required" },
          { status: 400 }
        );
      }

      const bankChanged =
        previous &&
        payload.bank_code &&
        String(previous.bank_code || "") !== String(payload.bank_code || "");
      if (bankChanged && !payload.account_number) {
        return NextResponse.json(
          {
            status: "error",
            message: "Please enter account_number to verify after changing the bank",
          },
          { status: 400 }
        );
      }

      const canVerify =
        userRequestedVerify &&
        Boolean(payload.account_number) &&
        Boolean(payload.bank_code) &&
        (currency === "NGN" || currency === "GHS");

      if (canVerify) {
        const derivedCountryCode =
          payload.country_code || (currency === "NGN" ? "NGN" : "GH");
        const verify = await verifyBankAccount({
          bankCode: payload.bank_code,
          accountNumber: payload.account_number,
          countryCode: derivedCountryCode,
        });
        if (verify.ok) {
          payload.account_name = verify.data.account_name;
          payload.verified = true;
        } else {
          payload.account_name = null;
          payload.verified = false;
        }
      } else {
        payload.verified = previous ? !!previous.verified : false;
        payload.account_name = previous ? previous.account_name : payload.account_name;
        if (payload.account_number || bankChanged) {
          payload.verified = false;
        }
      }
    } else if (payoutType === "mobile_money") {
      if (!payload.bank_code) {
        return NextResponse.json(
          { status: "error", message: "bank_code is required" },
          { status: 400 }
        );
      }
      if (!payload.msisdn) {
        return NextResponse.json(
          { status: "error", message: "msisdn is required" },
          { status: 400 }
        );
      }
      payload.verified = previous ? !!previous.verified : false;
      if (userRequestedVerify && (currency === "NGN" || currency === "GHS")) {
        const derivedCountryCode =
          payload.country_code || (currency === "NGN" ? "NGN" : "GH");
        const verify = await verifyBankAccount({
          bankCode: payload.bank_code,
          accountNumber: payload.msisdn,
          countryCode: derivedCountryCode,
        });
        if (verify.ok) {
          payload.account_name = verify.data.account_name;
          payload.verified = true;
        } else {
          payload.account_name = null;
          payload.verified = false;
        }
      }
    }

    if (record) {
      await record.update(payload);
    } else {
      record = await db.MarketplaceMerchantBank.create(payload);
    }

    return NextResponse.json({ status: "success", id: record.id });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/account/bank",
      method: "PATCH",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "account_bank_upsert",
    });
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
