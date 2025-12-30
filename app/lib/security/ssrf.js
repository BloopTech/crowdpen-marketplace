import dns from "dns";
import net from "net";

function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return true;
  const v = ip.trim();

  if (net.isIPv4(v)) {
    const [a, b] = v.split(".").map((n) => Number(n));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (net.isIPv6(v)) {
    const lower = v.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true; // link-local
    return false;
  }

  return true;
}

function normalizeHostname(hostname) {
  return String(hostname || "").trim().toLowerCase();
}

function parseAllowedHostsFromEnv() {
  const raw = process.env.SSRF_ALLOWED_HOSTS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function assertSafeExternalUrl(urlString, opts = {}) {
  const { allowedHosts = parseAllowedHostsFromEnv() } = opts;

  let u;
  try {
    u = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (u.username || u.password) {
    throw new Error("Credentials in URL are not allowed");
  }

  const protocol = u.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const host = normalizeHostname(u.hostname);
  if (!host) throw new Error("Invalid host");

  if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
    throw new Error("Host not allowed");
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new Error("Private IPs are not allowed");
    }
    return u;
  }

  const lookup = dns.promises.lookup;
  const results = await lookup(host, { all: true, verbatim: true });
  if (!results || results.length === 0) throw new Error("DNS lookup failed");

  for (const r of results) {
    if (isPrivateIp(r.address)) {
      throw new Error("Resolved to a private IP");
    }
  }

  return u;
}
