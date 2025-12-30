import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    NEXTAUTH_URL: z.string().optional(),
    NEXTAUTH_SECRET: z.string().optional(),
    DB_URL: z.string().optional(),
    STARTBUTTON_SECRET_KEY: z.string().optional(),
    STARTBUTTON_WEBHOOK_SECRET: z.string().optional(),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
    CLOUDFLARE_R2_ENDPOINT: z.string().optional(),
    CLOUDFLARE_R2_PUBLIC_URL: z.string().optional(),
    CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(),
    EMAIL_SERVER_HOST: z.string().optional(),
    EMAIL_SERVER_PORT: z.string().optional(),
    EMAIL_SERVER_USER: z.string().optional(),
    EMAIL_SERVER_PASSWORD: z.string().optional(),
  })
  .passthrough();

let cachedEnv;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} not configured`);
  }
  return v;
}

export function assertRequiredEnvInProduction(requiredNames) {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  if (env !== "production") return;

  const missing = [];
  for (const n of requiredNames || []) {
    if (!process.env[n]) missing.push(n);
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function assertAnyEnvInProduction(candidateNames) {
  const env = (process.env.NODE_ENV || "development").toLowerCase();
  if (env !== "production") return;

  const ok = (candidateNames || []).some((n) => !!process.env[n]);
  if (!ok) {
    throw new Error(`Missing required environment variable (one of): ${(candidateNames || []).join(", ")}`);
  }
}
