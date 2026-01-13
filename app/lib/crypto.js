// app/lib/crypto.js
// Utility for encrypting/decrypting sensitive strings at rest using AES-256-GCM
// Do NOT log decrypted values.

import "server-only";
import crypto from "crypto";
import { assertAnyEnvInProduction } from "./env";

const getSecret = () => {
  assertAnyEnvInProduction(["BANK_ENCRYPTION_SECRET", "ENCRYPTION_KEY"]);
  const secret = process.env.BANK_ENCRYPTION_SECRET || process.env.API_ENCRYPTION_KEY;
  if (!secret) {
    // In production, this MUST be set. We avoid throwing to keep dev smooth,
    // but encryption will be weak if undefined. Warn loudly.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[crypto] BANK_ENCRYPTION_SECRET/ENCRYPTION_KEY not set. Using ephemeral dev key.");
    }
  }
  // Derive a 32-byte key via SHA-256 to ensure proper length
  const key = crypto.createHash("sha256").update(secret || "dev-unsafe-key").digest();
  return key; // Buffer length 32
};

const ALGO = "aes-256-gcm";

export function encryptString(plainText) {
  if (plainText == null) return null;
  const key = getSecret();
  const iv = crypto.randomBytes(12); // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Serialize as versioned format
  const payload = `v1:${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;
  return payload;
}

export function decryptString(payload) {
  if (!payload) return null;
  try {
    const [version, ivHex, ctHex, tagHex] = String(payload).split(":");
    if (version !== "v1") return null;
    const key = getSecret();
    const iv = Buffer.from(ivHex, "hex");
    const ciphertext = Buffer.from(ctHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return plain;
  } catch (_) {
    // Never throw decrypted failures, just return null
    return null;
  }
}

export function maskNumber(num, visible = 4, maskChar = "•") {
  if (!num) return "";
  const s = String(num);
  if (s.length <= visible) return s;
  const masked = maskChar.repeat(Math.max(0, s.length - visible)) + s.slice(-visible);
  // Group in 4s for readability if numeric
  return masked.replace(/(.{4})/g, "$1 ").trim();
}
