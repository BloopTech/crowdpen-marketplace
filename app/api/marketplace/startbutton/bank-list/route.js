import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

const getBaseUrl = () =>
  process.env.STARTBUTTON_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api.startbutton.tech"
     //: "https://api-dev.startbutton.tech");
    : "https://api.startbutton.tech");

const getSecret = () => process.env.STARTBUTTON_SECRET_KEY;

const FALLBACK_COUNTRY = (process.env.MARKETPLACE_DEFAULT_COUNTRY || "GH").toUpperCase();
const GEOLOOKUP_URL_TEMPLATE =
  process.env.GEOLOCATION_LOOKUP_URL || "https://ipwho.is/{ip}";

function readCountryHeader(headers) {
  const vercel = headers.get("x-vercel-ip-country");
  const cf = headers.get("cf-ipcountry");
  const generic = headers.get("x-country-code");
  const codeFromHeader = (vercel || cf || generic || "").toUpperCase();
  if (codeFromHeader) {
    console.log("Header country code:", codeFromHeader, vercel, cf, generic);
    return codeFromHeader;
  }
  return null;
}

function sanitizeIp(raw) {
  if (!raw) return null;
  let ip = raw.trim();
  // Remove IPv6 scope identifiers (e.g., fe80::1%lo0)
  if (ip.includes("%")) {
    ip = ip.split("%")[0];
  }
  // Handle IPv4-mapped IPv6 addresses (::ffff:1.2.3.4)
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  console.log("Sanitized IP:", ip, "(raw:", raw, ")");
  return ip;
}

function getClientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const candidates = forwarded.split(",").map((part) => sanitizeIp(part || ""));
    for (const candidate of candidates) {
      if (!candidate) continue;
      console.log("Forwarded IP candidate:", candidate, "isPrivate:", isPrivateIp(candidate));
      if (!isPrivateIp(candidate)) {
        return candidate;
      }
    }
    const first = candidates.find(Boolean);
    if (first) {
      console.log("Using first forwarded IP (all private):", first);
      return first;
    }
  }
  const fallback =
    sanitizeIp(headers.get("x-real-ip")) ||
    sanitizeIp(headers.get("cf-connecting-ip")) ||
    sanitizeIp(headers.get("fastly-client-ip")) ||
    sanitizeIp(headers.get("true-client-ip"));
  console.log("Fallback IP:", fallback);
  return fallback || null;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  const normalized = ip.trim().toLowerCase();
  if (normalized === "127.0.0.1" || normalized === "::1") return true;
  if (normalized.startsWith("10.")) return true;
  if (normalized.startsWith("192.168.")) return true;
  if (normalized.startsWith("172.")) {
    const parts = normalized.split(".");
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // IPv6 unique local addresses
  if (normalized.startsWith("fe80")) return true; // IPv6 link-local
  return false;
}

function buildGeoLookupUrl(ip) {
  return GEOLOOKUP_URL_TEMPLATE.replace("{ip}", encodeURIComponent(ip));
}

async function fetchCountryFromIp(ip) {
  try {
    const url = buildGeoLookupUrl(ip);
    console.log("Geo lookup URL:", url);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    console.log("Geo lookup response:", res);
    if (!res.ok) {
      console.log("Geo lookup request failed", res.status, url);
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return null;
    const codeRaw =
      (typeof data.country_code === "string" && data.country_code) ||
      (typeof data.countryCode === "string" && data.countryCode) ||
      (typeof data.country === "string" && data.country.length === 2
        ? data.country
        : null);
    if (codeRaw) {
      return codeRaw.slice(0, 2).toUpperCase();
    }
  } catch (error) {
    console.log("Geo lookup error for IP", ip, error);
  }
  return null;
}

async function resolveCountry(request) {
  const headers = request.headers;
  const headerCountry = readCountryHeader(headers);
  console.log("Header country:", headerCountry);
  if (headerCountry) return headerCountry;

  const ip = getClientIp(headers);
  console.log("Client IP:", ip);
  if (ip && !isPrivateIp(ip)) {
    const lookupCountry = await fetchCountryFromIp(ip);
    console.log("Lookup country:", lookupCountry);
    if (lookupCountry) return lookupCountry;
  }
console.log("Fallback country:", FALLBACK_COUNTRY);
  return FALLBACK_COUNTRY;
}

function deriveCurrencyAndCountry(code) {
  const c = (code || "").toUpperCase();
  // Direct mappings
  const map = {
    NG: { currency: "NGN", countryCode: "NG" },
    GH: { currency: "GHS", countryCode: "GH" },
    ZA: { currency: "ZAR", countryCode: "ZA" },
    KE: { currency: "KES", countryCode: "KE" },
    UG: { currency: "UGX", countryCode: "UG" },
    RW: { currency: "RWF", countryCode: "RW" },
    TZ: { currency: "TZS", countryCode: "TZ" },
    ZM: { currency: "ZMW", countryCode: "ZM" },
    // XOF region
    CI: { currency: "XOF", countryCode: "CI" },
    BJ: { currency: "XOF", countryCode: "BJ" },
    TG: { currency: "XOF", countryCode: "TG" },
    SN: { currency: "XOF", countryCode: "SN" },
    ML: { currency: "XOF", countryCode: "ML" },
    BF: { currency: "XOF", countryCode: "BF" },
  };
  return map[c] || { currency: "NGN" }; // default NGN
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { status: "error", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bank"; // bank | mobile_money
    let currency = searchParams.get("currency");
    let countryCode = searchParams.get("countryCode") || undefined;
    const resolvedCountry = await resolveCountry(request);
    const basis = countryCode || resolvedCountry || FALLBACK_COUNTRY;
    const derived = deriveCurrencyAndCountry(basis);
    if (!currency) {
      currency = derived.currency;
    }
    if (!countryCode) {
      // Keep explicit param if provided; otherwise prefer derived countryCode or basis
      countryCode = derived.countryCode || basis || undefined;
    }

    const base = getBaseUrl();
    const secret = getSecret();
    if (!secret) {
      return NextResponse.json(
        { status: "error", message: "Startbutton secret not configured" },
        { status: 500 }
      );
    }

    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (countryCode) qs.set("countryCode", countryCode);

    const upstreamUrl = `${base}/bank/list/${encodeURIComponent(currency)}${qs.toString() ? `?${qs.toString()}` : ""}`;

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data?.success === false) {
      return NextResponse.json(
        {
          status: "error",
          message: data?.message || "Failed to fetch bank list",
        },
        { status: upstream.status || 500 }
      );
    }

    // Normalize to simple array
    const banks = Array.isArray(data?.data) ? data.data : [];
    return NextResponse.json({ status: "success", banks, currency, countryCode: countryCode || null });
  } catch (error) {
    console.error("bank-list proxy error:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
