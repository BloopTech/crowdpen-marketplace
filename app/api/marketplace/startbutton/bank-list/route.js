import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";
import { assertAnyEnvInProduction } from "../../../../lib/env";
import { assertSafeExternalUrl } from "../../../../lib/security/ssrf";
import { isIP } from "net";
import { getRequestIdFromHeaders, reportError } from "../../../../lib/observability/reportError";

export const runtime = "nodejs";

assertAnyEnvInProduction([
  "STARTBUTTON_SECRET_KEY",
  "STARTBUTTON_SECRET",
  "STARTBUTTON_API_KEY",
]);

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

const FALLBACK_COUNTRY = (process.env.MARKETPLACE_DEFAULT_COUNTRY || "GH").toUpperCase();
const GEOLOOKUP_URL_TEMPLATE =
  process.env.GEOLOCATION_LOOKUP_URL || "https://ipwho.is/{ip}";

function getGeoLookupAllowedHost() {
  try {
    const sample = GEOLOOKUP_URL_TEMPLATE.replace("{ip}", "1.1.1.1");
    return new URL(sample).hostname.toLowerCase();
  } catch {
    return "ipwho.is";
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...(options || {}), signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function readCountryHeader(headers) {
  const vercel = headers.get("x-vercel-ip-country");
  const cf = headers.get("cf-ipcountry");
  const generic = headers.get("x-country-code");
  const codeFromHeader = (vercel || cf || generic || "").toUpperCase();
  if (codeFromHeader) {
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
  return ip;
}

function getClientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const candidates = forwarded.split(",").map((part) => sanitizeIp(part || ""));
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (!isPrivateIp(candidate)) {
        return candidate;
      }
    }
    const first = candidates.find(Boolean);
    if (first) {
      return first;
    }
  }
  const fallback =
    sanitizeIp(headers.get("x-real-ip")) ||
    sanitizeIp(headers.get("cf-connecting-ip")) ||
    sanitizeIp(headers.get("fastly-client-ip")) ||
    sanitizeIp(headers.get("true-client-ip"));
  return fallback || null;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  const normalized = ip.trim().toLowerCase();
  if (isIP(normalized) === 0) return true;
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

    let safeUrl;
    try {
      safeUrl = await assertSafeExternalUrl(url, { allowedHosts: [getGeoLookupAllowedHost()] });
    } catch {
      return null;
    }

    const res = await fetchWithTimeout(
      safeUrl.toString(),
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
      2500
    );
    if (!res.ok) {
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
  }
  return null;
}

async function resolveCountry(request) {
  const headers = request.headers;
  const headerCountry = readCountryHeader(headers);
  if (headerCountry) return headerCountry;

  const ip = getClientIp(headers);
  if (ip && !isPrivateIp(ip)) {
    const lookupCountry = await fetchCountryFromIp(ip);
    if (lookupCountry) return lookupCountry;
  }
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
    const rl = rateLimit({ key: `sb-bank-list:${userId}:${ip}`, limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
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

    const upstream = await fetchWithTimeout(
      safeUpstream.toString(),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        cache: "no-store",
      },
      10000
    );

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
    const rawBanks = Array.isArray(data?.data) ? data.data : [];
    const banks = rawBanks
      .map((b) => {
        const code =
          b?.code ??
          b?.bankCode ??
          b?.bank_code ??
          b?.bank_code?.toString?.() ??
          b?.id ??
          b?._id ??
          "";
        const name =
          b?.name ??
          b?.bankName ??
          b?.bank_name ??
          b?.title ??
          "";
        const id = b?.id ?? b?.bankId ?? b?.bank_id ?? b?._id ?? null;
        return {
          ...b,
          id,
          code: String(code || ""),
          name: String(name || ""),
        };
      })
      .filter((b) => b?.code && b?.name);
    return NextResponse.json({ status: "success", banks, currency, countryCode: countryCode || null });
  } catch (error) {
    await reportError(error, {
      route: "/api/marketplace/startbutton/bank-list",
      method: "GET",
      status: 500,
      requestId,
      userId: session?.user?.id || null,
      tag: "startbutton_bank_list_proxy",
    });
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      { status: "error", message: isProd ? "Server error" : (error?.message || "Server error") },
      { status: 500 }
    );
  }
}
