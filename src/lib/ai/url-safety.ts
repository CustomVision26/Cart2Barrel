/**
 * Basic SSRF guards for server-side URL fetching before OpenAI processing.
 * Does not replace a full egress firewall; blocks obvious private/local targets.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.goog",
]);

function ipv4ToInt(parts: number[]): number {
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if ([a, b, c, d].some((n) => n > 255)) return true;
  const n = ipv4ToInt([a, b, c, d]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (n >= ipv4ToInt([100, 64, 0, 0]) && n <= ipv4ToInt([100, 127, 255, 255])) return true;
  return false;
}

export function assertHttpsProductUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid URL.");
  }
  if (u.protocol !== "https:") {
    throw new Error("Only https:// URLs are allowed.");
  }
  if (u.username || u.password) {
    throw new Error("URLs with credentials are not allowed.");
  }
  const host = u.hostname.toLowerCase();
  if (!host || BLOCKED_HOSTNAMES.has(host)) {
    throw new Error("This host is not allowed.");
  }
  if (host.endsWith(".local")) {
    throw new Error("This host is not allowed.");
  }
  if (isBlockedIpv4(host)) {
    throw new Error("This host is not allowed.");
  }
  return u;
}
