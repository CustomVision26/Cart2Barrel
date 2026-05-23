function addOriginFromUrl(parties: Set<string>, raw: string | undefined): void {
  const trimmed = raw?.trim();
  if (!trimmed) return;
  try {
    parties.add(new URL(trimmed).origin);
  } catch {
  }
}

function addOriginFromHost(parties: Set<string>, host: string | undefined): void {
  const trimmed = host?.trim();
  if (!trimmed) return;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    addOriginFromUrl(parties, trimmed);
    return;
  }
  addOriginFromUrl(parties, `https://${trimmed}`);
}

/**
 * Origins that may issue session tokens (fixes handshake / redirect loops when using
 * tunnels or multiple dev URLs). Clerk validates `azp` / authorized parties against this list.
 */
export function clerkAuthorizedParties(): string[] | undefined {
  const parties = new Set<string>([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);

  addOriginFromUrl(parties, process.env.NEXT_PUBLIC_APP_URL);
  addOriginFromHost(parties, process.env.VERCEL_URL);
  addOriginFromHost(parties, process.env.VERCEL_BRANCH_URL);
  addOriginFromHost(parties, process.env.VERCEL_PROJECT_PRODUCTION_URL);

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

/** PEM JWT public key for Edge — skip if missing or malformed (avoids middleware crash on Vercel). */
export function parseClerkJwtKeyForMiddleware(): string | undefined {
  const raw = process.env.CLERK_JWT_KEY?.trim();
  if (!raw) return undefined;
  const key = raw.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PUBLIC KEY") || !key.includes("END PUBLIC KEY")) {
    return undefined;
  }
  return key;
}
