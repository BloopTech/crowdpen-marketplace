"use client";

const SESSION_KEY = "cp_marketplace_session_id_v1";

function setCookieSessionId(id) {
  try {
    if (!id) return;
    const maxAge = 60 * 60 * 24 * 180;
    const secure =
      typeof window !== "undefined" &&
      window.location &&
      window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${SESSION_KEY}=${encodeURIComponent(
      id
    )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    // swallow
  }
}

function generateId() {
  try {
    const c = globalThis?.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {}

  const rnd = () => Math.floor(Math.random() * 1e16).toString(16);
  return `${Date.now().toString(16)}-${rnd()}-${rnd()}-${rnd()}`;
}

export function getFunnelSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && String(existing).trim().length >= 8) {
      setCookieSessionId(existing);
      return existing;
    }
    const id = generateId();
    localStorage.setItem(SESSION_KEY, id);
    setCookieSessionId(id);
    return id;
  } catch {
    return null;
  }
}

export async function trackFunnelEvent(event) {
  try {
    getFunnelSessionId();

    const payload = {
      event_name: event?.event_name,
      marketplace_product_id: event?.marketplace_product_id || null,
      marketplace_order_id: event?.marketplace_order_id || null,
      metadata: event?.metadata || null,
    };

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = setTimeout(() => {
      try {
        controller?.abort();
      } catch {}
    }, 1500);

    await fetch("/api/marketplace/funnel-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      signal: controller?.signal,
    }).catch(() => null);

    clearTimeout(timeout);
  } catch {
    // swallow
  }
}
