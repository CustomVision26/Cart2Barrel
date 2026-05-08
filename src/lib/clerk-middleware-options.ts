/**
 * Origins that may issue session tokens (fixes handshake / redirect loops when using
 * tunnels or multiple dev URLs). Clerk validates `azp` / authorized parties against this list.
 */
export function clerkAuthorizedParties(): string[] | undefined {
  const parties = new Set<string>([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      parties.add(new URL(appUrl).origin);
    } catch {
      /* ignore invalid URL */
    }
  }

  const raw = process.env.CLERK_AUTHORIZED_PARTIES;
  const extra = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  for (const p of extra) {
    try {
      parties.add(new URL(p).origin);
    } catch {
      parties.add(p);
    }
  }

  return Array.from(parties);
}
