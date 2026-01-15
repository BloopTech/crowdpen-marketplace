import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { assertSafeExternalUrl } from "../../../../lib/security/ssrf";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

const getBaseUrl = () =>
  process.env.STARTBUTTON_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.startbutton.tech"
    //: "https://api-dev.startbutton.tech");
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

function getHeaderCountry(request) {
  const h = request.headers;
  const vercel = h.get("x-vercel-ip-country");
  const cf = h.get("cf-ipcountry");
  const generic = h.get("x-country-code");
  const code = (vercel || cf || generic || "").toUpperCase();
  return code || null;
}

function deriveCurrency(code) {
  const c = (code || "").toUpperCase();
  const map = {
    NG: "NGN",
    GH: "GHS",
    ZA: "ZAR",
    KE: "KES",
    UG: "UGX",
    RW: "RWF",
    TZ: "TZS",
    ZM: "ZMW",
    CI: "XOF",
    BJ: "XOF",
    TG: "XOF",
    SN: "XOF",
    ML: "XOF",
    BF: "XOF",
  };
  return map[c] || null;
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

    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const userId = String(session.user.id);
    const rl = rateLimit({ key: `sb-verify:${userId}:${ip}`, limit: 30, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const { searchParams } = new URL(request.url);
    const bankCode = searchParams.get("bankCode");
    const accountNumber = searchParams.get("accountNumber");
    let countryCode = searchParams.get("countryCode");

    if (!bankCode || !accountNumber) {
      return NextResponse.json(
        { status: "error", message: "bankCode and accountNumber are required" },
        { status: 400 }
      );
    }

    const base = getBaseUrl();
    const secret = getSecret();
    if (!secret) {
      return NextResponse.json(
        { status: "error", message: "Startbutton secret not configured" },
        { status: 500 }
      );
    }

    // Auto-derive country for verification if not provided. If not NGN/GHS, do not block; let upstream decide.
    if (!countryCode) {
      const ipCountry = getHeaderCountry(request);
      const currency = deriveCurrency(ipCountry);
      if (currency === "GHS") countryCode = "GH";
      else if (currency === "NGN") countryCode = "NG";
      // else leave undefined; upstream may return an informative error for unsupported regions
    }

    const qs = new URLSearchParams();
    qs.set("bankCode", bankCode);
    qs.set("accountNumber", accountNumber);
    if (countryCode) qs.set("countryCode", countryCode);

    const upstreamUrl = `${base}/bank/verify?${qs.toString()}`;

    let safeUpstream;
    try {
      const baseHost = new URL(base).hostname.toLowerCase();
      if (!ALLOWED_STARTBUTTON_HOSTS.has(baseHost)) {
        throw new Error("Invalid upstream");
      }
      safeUpstream = await assertSafeExternalUrl(upstreamUrl, { allowedHosts: [baseHost] });
    } catch {
      return NextResponse.json(
        { status: "error", message: "Upstream not available" },
        { status: 502 }
      );
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
      return NextResponse.json(
        { status: "error", message: data?.message || "Verification failed" },
        { status: upstream.status || 500 }
      );
    }

    return NextResponse.json({ status: "success", data: data?.data || null });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/startbutton/verify",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "startbutton_verify_proxy",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Server error" : (error?.message || "Server error") },
      { status: 500 }
    );
  }
}
