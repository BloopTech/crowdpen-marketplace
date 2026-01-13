import crypto from "crypto";

let dbPromise;

async function getDbSafe() {
  if (!dbPromise) {
    dbPromise = import("../../models")
      .then((m) => m?.db || m?.default || null)
      .catch(() => null);
  }
  return await dbPromise;
}

function truncateText(value, maxLen) {
  const s = value == null ? "" : String(value);
  if (!maxLen || s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function isUuid(value) {
  const s = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function looksSensitiveMessage(error, message) {
  if (!message) return false;

  if (error?.sql || error?.query) return true;

  const s = String(message);
  if (/\b(select|insert|update|delete)\b/i.test(s) && /\bfrom\b/i.test(s)) return true;
  if (/\b(password|authorization|cookie|set-cookie|secret|token)\b/i.test(s)) return true;
  return false;
}

function safeMessage(error) {
  const raw = truncateText(error?.message || "", 2000) || null;
  if (!raw) return null;
  if (looksSensitiveMessage(error, raw)) return null;
  return raw;
}

function safeStack(stack) {
  const s = truncateText(stack, 8000);
  return s || null;
}

function pickTopStackFrame(stack) {
  const s = String(stack || "");
  const lines = s.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;
    if (line.toLowerCase().startsWith("error")) continue;
    return truncateText(line, 300);
  }
  return null;
}

function computeFingerprint({ errorName, pgCode, route, method, topFrame }) {
  const base = [
    errorName || "UnknownError",
    pgCode || "",
    method || "",
    route || "",
    topFrame || "",
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

function extractPgFields(error) {
  const original = error?.original || error?.parent || null;
  const pgCode = original?.code || error?.code || null;
  const constraintName =
    original?.constraint ||
    original?.constraint_name ||
    error?.constraint ||
    error?.constraint_name ||
    null;
  return {
    pgCode: pgCode ? String(pgCode) : null,
    constraintName: constraintName ? String(constraintName) : null,
  };
}

function sanitizeContext(context) {
  const c = context || {};
  const out = {
    route: c.route || null,
    method: c.method || null,
    status: c.status != null ? Number(c.status) : null,
    requestId: c.requestId || null,
    userId: c.userId || null,
    tag: c.tag || null,
  };

  if (c.extra && typeof c.extra === "object") {
    out.extra = c.extra;
  }

  return out;
}

async function withStatementTimeout(db, timeoutMs, fn) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return await fn(null);

  if (!db?.sequelize?.transaction) return await fn(null);

  return await db.sequelize.transaction(async (transaction) => {
    await db.sequelize.query("SET LOCAL statement_timeout = :timeout", {
      transaction,
      replacements: { timeout: Math.floor(ms) },
      type: db.Sequelize.QueryTypes.RAW,
    });
    return await fn(transaction);
  });
}

export function getRequestIdFromHeaders(headers) {
  if (!headers?.get) return null;
  return (
    headers.get("x-request-id") ||
    headers.get("x-vercel-id") ||
    headers.get("x-amzn-trace-id") ||
    null
  );
}

export function createRequestId() {
  return crypto.randomUUID();
}

function isLocalhostLike(value) {
  if (!value) return false;
  const s = String(value).toLowerCase();
  return (
    s.includes("localhost") ||
    s.includes("127.0.0.1") ||
    s.includes("0.0.0.0")
  );
}

function shouldPersistErrorEvents() {
  const vercelEnv = process.env.VERCEL_ENV;
  const isProdDeployment = vercelEnv
    ? vercelEnv === "production"
    : process.env.NODE_ENV === "production";

  const envUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    null;

  return isProdDeployment && !isLocalhostLike(envUrl);
}

export async function reportError(error, context) {
  const ctx = sanitizeContext(context);

  const errorName = error?.name ? String(error.name) : "Error";
  const message = safeMessage(error);
  const stack = safeStack(error?.stack);

  const { pgCode, constraintName } = extractPgFields(error);

  const topFrame = pickTopStackFrame(stack);
  const fingerprint = computeFingerprint({
    errorName,
    pgCode,
    route: ctx.route,
    method: ctx.method,
    topFrame,
  });

  const requestId = ctx.requestId || createRequestId();

  console.error(
    JSON.stringify({
      level: "error",
      event: "marketplace.error",
      requestId,
      fingerprint,
      route: ctx.route,
      method: ctx.method,
      status: ctx.status,
      errorName,
      message,
      pgCode,
      constraintName,
    })
  );

  if (!shouldPersistErrorEvents()) {
    return { requestId, fingerprint };
  }

  const sampleContext = {
    ...ctx,
    fingerprint,
  };

  const sampleContextJson = JSON.stringify(sampleContext);

  try {
    const db = await getDbSafe();
    const userId = ctx.userId && isUuid(ctx.userId) ? String(ctx.userId) : null;
    const route = ctx.route ? String(ctx.route) : null;
    const method = ctx.method ? String(ctx.method) : null;
    const status = ctx.status != null ? Number(ctx.status) : null;

    if (db?.MarketplaceErrorEvent?.upsertFromReport) {
      await db.MarketplaceErrorEvent.upsertFromReport({
        fingerprint,
        route,
        method,
        status,
        errorName,
        pgCode,
        constraintName,
        message,
        stack,
        contextJson: sampleContextJson,
        requestId,
        userId,
      });
    }

    if (process.env.OBS_QUEUE_ERROR_EVENTS === "true" && db?.sequelize?.query) {
      const jobDataJson = JSON.stringify({
        fingerprint,
        requestId,
        route,
        method,
        status,
        errorName,
        pgCode,
        constraintName,
        message,
      });

      await withStatementTimeout(db, 250, async (transaction) => {
        await db.sequelize.query(
          `INSERT INTO pgboss_v11.job_common (name, data, policy, singleton_key)
           VALUES (:name, :data::jsonb, 'short', :singletonKey)
           ON CONFLICT DO NOTHING`,
          {
            transaction,
            replacements: {
              name: "marketplace.errorEvent",
              data: jobDataJson,
              singletonKey: fingerprint,
            },
            type: db.Sequelize.QueryTypes.RAW,
          }
        );
      });
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "marketplace.error.report_failed",
        requestId,
        fingerprint,
        errorName: e?.name || "Error",
        message: e?.message || "Failed to persist error",
      })
    );
  }

  return { requestId, fingerprint };
}
