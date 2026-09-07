import { timingSafeEqual } from "node:crypto";

import { refreshStaleSpotlightRetailerChecks } from "@/data/spotlight-retailer-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Intentionally unauthenticated: Vercel Cron (or an ops scheduler) calls this
 * to refresh stale spotlight retailer snapshots. Require CRON_SECRET as
 * `?token=` or `Authorization: Bearer`.
 */
function cronSecretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  if (!expected) {
    return new Response("CRON_SECRET is not set.", { status: 500 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const auth = request.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const provided = token || bearer;
  if (!provided || !cronSecretMatches(provided, expected)) {
    return new Response("Unauthorized.", { status: 401 });
  }

  try {
    const result = await refreshStaleSpotlightRetailerChecks({
      limit: 24,
      concurrency: 3,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Retailer check failed.";
    return Response.json({ ok: false, message }, { status: 500 });
  }
}
