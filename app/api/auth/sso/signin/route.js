import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "../../../../models";
import { getClientIpFromHeaders, rateLimit, rateLimitResponseHeaders } from "../../../../lib/security/rateLimit";

const { User, Session } = db;

function safeTimingEqual(a, b) {
  try {
    const aBuf = Buffer.from(String(a || ""));
    const bBuf = Buffer.from(String(b || ""));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function normalizeSha256SignatureToHex(sig) {
  const sigText = String(sig || "").trim();
  if (!sigText) return null;

  const hexMatch = sigText.match(/^(?:sha256=)?([0-9a-f]{64})$/i);
  if (hexMatch && hexMatch[1]) return String(hexMatch[1]).toLowerCase();

  const rawText = sigText.startsWith("sha256=") ? sigText.slice("sha256=".length) : sigText;
  const raw = rawText.replace(/ /g, "+");
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

  try {
    const buf = Buffer.from(padded, "base64");
    if (buf.length !== 32) return null;
    return buf.toString("hex");
  } catch {
    return null;
  }
}

function getSecretKeyCandidates(secret) {
  const candidates = [];
  const raw = String(secret || "");
  if (raw) candidates.push(raw);

  const trimmed = raw.trim();
  if (trimmed) {
    try {
      const buf = Buffer.from(trimmed, "base64");
      const reEncoded = buf.toString("base64");
      const normA = trimmed.replace(/=+$/g, "");
      const normB = reEncoded.replace(/=+$/g, "");
      if (buf.length >= 16 && normA && normA === normB) {
        candidates.push(buf);
      }
    } catch {}
  }

  return candidates;
}

export async function POST(request) {
  const cookieStore = await cookies();

  try {
    const ip = getClientIpFromHeaders(request.headers) || "unknown";
    const rl = rateLimit({ key: `sso-signin:${ip}`, limit: 60, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitResponseHeaders(rl) }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { userData, callbackUrl, sig, ts } = body || {};

    const safeRedirectUrl =
      typeof callbackUrl === "string" && callbackUrl.startsWith("/")
        ? callbackUrl.slice(0, 2048)
        : "/";

    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      const secret = process.env.CROWDPEN_SSO_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: "SSO not configured" },
          { status: 501 }
        );
      }

      if (typeof userData !== "string") {
        return NextResponse.json(
          { error: "Invalid user data format" },
          { status: 400 }
        );
      }

      if (userData.length === 0) {
        return NextResponse.json(
          { error: "No user data provided" },
          { status: 400 }
        );
      }

      if (userData.length > 20_000) {
        return NextResponse.json(
          { error: "User data payload too large" },
          { status: 413 }
        );
      }

      const sigHex = normalizeSha256SignatureToHex(sig);
      if (!sigHex) {
        return NextResponse.json(
          { error: "Invalid SSO signature" },
          { status: 403 }
        );
      }

      const tsNum = Number.parseInt(String(ts || ""), 10);
      if (!Number.isFinite(tsNum)) {
        return NextResponse.json(
          { error: "Invalid SSO timestamp" },
          { status: 400 }
        );
      }

      const maxSkewMs = 5 * 60 * 1000;
      const tsMs = tsNum < 1_000_000_000_000 ? tsNum * 1000 : tsNum;
      const skew = Math.abs(Date.now() - tsMs);
      if (!Number.isFinite(skew) || skew > maxSkewMs) {
        return NextResponse.json(
          { error: "Expired SSO request" },
          { status: 403 }
        );
      }

      const payload = `${tsNum}.${userData}`;
      const secretCandidates = getSecretKeyCandidates(secret);
      const ok = secretCandidates.some((key) => {
        const expected = crypto
          .createHmac("sha256", key)
          .update(payload)
          .digest("hex");
        return safeTimingEqual(expected, sigHex);
      });

      if (!ok) {
        return NextResponse.json(
          { error: "Invalid SSO signature" },
          { status: 403 }
        );
      }
    }

    if (!userData) {
      return NextResponse.json(
        { error: "No user data provided" },
        { status: 400 }
      );
    }

    // Parse user data
    let parsedUserData;
    try {
      parsedUserData =
        typeof userData === "string" ? JSON.parse(userData) : userData;
    } catch (error) {
      console.error("Failed to parse user data:", error);
      return NextResponse.json(
        { error: "Invalid user data format" },
        { status: 400 }
      );
    }

    if (!parsedUserData.email || !parsedUserData.id) {
      return NextResponse.json(
        { error: "Missing required user data" },
        { status: 400 }
      );
    }

    const email = String(parsedUserData.email || "").toLowerCase().slice(0, 320);
    const userId = String(parsedUserData.id || "").slice(0, 128);
    if (!email || !email.includes("@") || !userId) {
      return NextResponse.json(
        { error: "Invalid user data" },
        { status: 400 }
      );
    }

    // Find or create user in database
    const dbUser = await User.findOne({
      where: { email },
      defaults: {
        id: parsedUserData.id,
        email: parsedUserData.email,
        name: parsedUserData.name,
        image: parsedUserData.image,
      },
    });

    if (!dbUser || String(dbUser.id) !== String(parsedUserData.id)) {
      return NextResponse.json(
        { error: "User not found in database" },
        { status: 404 }
      );
    }

    // Create database session
    const sessionToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const session = await Session.create({
      session_token: sessionToken,
      user_id: dbUser.id,
      expires: expires,
    });

    // Set session cookie (handle both development and production)
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction ? "__Secure-next-auth.session-token" : "next-auth.session-token";
    
    cookieStore.set(cookieName, sessionToken, {
      expires: expires,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
    });
    

    return NextResponse.json({
      success: true,
      redirectUrl: safeRedirectUrl,
    });
  } catch (error) {
    console.error("SSO direct signin error:", error);
    const isProd = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: "Failed to create session",
        ...(isProd ? {} : { details: error?.message }),
      },
      { status: 500 }
    );
  }
}
