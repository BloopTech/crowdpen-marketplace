function getStore() {
  if (!globalThis.__cp_rate_limit_store) {
    globalThis.__cp_rate_limit_store = new Map();
  }
  return globalThis.__cp_rate_limit_store;
}

function cleanupStore(store, t) {
  if (!store || store.size < 10000) return;
  for (const [k, v] of store.entries()) {
    if (!v || typeof v.resetAt !== "number" || v.resetAt <= t) {
      store.delete(k);
    }
  }
}

function nowMs() {
  return Date.now();
}

export function getClientIpFromHeaders(headers) {
  try {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    return (
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip") ||
      headers.get("true-client-ip") ||
      headers.get("fastly-client-ip") ||
      ""
    ).trim();
  } catch {
    return "";
  }
}

export function rateLimit({
  key,
  limit,
  windowMs,
}) {
  const store = getStore();
  const t = nowMs();

  cleanupStore(store, t);

  const k = String(key || "");
  if (!k) {
    return { ok: true, remaining: limit, resetAt: t + windowMs };
  }

  const existing = store.get(k);
  if (!existing || existing.resetAt <= t) {
    const resetAt = t + windowMs;
    store.set(k, { count: 1, resetAt });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  existing.count += 1;
  store.set(k, existing);

  const remaining = Math.max(0, limit - existing.count);
  return { ok: existing.count <= limit, remaining, resetAt: existing.resetAt };
}

export function rateLimitResponseHeaders({ remaining, resetAt }) {
  const headers = new Headers();
  headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining ?? 0)));
  if (resetAt) headers.set("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
  return headers;
}
