import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordPageVisit } from "@/data/page-visits";
import {
  SITE_TRAFFIC_VISITOR_COOKIE,
  SITE_TRAFFIC_VISITOR_COOKIE_MAX_AGE_SECONDS,
  isSiteTrafficVisitorId,
  sanitizeTrackedPath,
  sanitizeTrackedReferrer,
} from "@/lib/site-traffic";
import { recordPageVisitSchema } from "@/lib/validations/page-visit";

export const runtime = "nodejs";

/**
 * Intentionally unauthenticated: guests and signed-in shoppers both record
 * first-party page views. Clerk `userId` is attached only when a session exists.
 * Uses a Route Handler (not a Server Action) so cookie writes do not refresh
 * the App Router tree during client navigations.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = recordPageVisitSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = sanitizeTrackedPath(parsed.data.path);
  if (!path) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const referrer = sanitizeTrackedReferrer(parsed.data.referrer ?? null);

  try {
    const { userId } = await auth();
    const jar = await cookies();
    let visitorId = jar.get(SITE_TRAFFIC_VISITOR_COOKIE)?.value ?? "";
    const response = NextResponse.json({ ok: true });

    if (!isSiteTrafficVisitorId(visitorId)) {
      visitorId = crypto.randomUUID();
      response.cookies.set({
        name: SITE_TRAFFIC_VISITOR_COOKIE,
        value: visitorId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SITE_TRAFFIC_VISITOR_COOKIE_MAX_AGE_SECONDS,
      });
    }

    await recordPageVisit({
      visitorId,
      clerkUserId: userId ?? null,
      path,
      referrer,
    });
    return response;
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] record page visit failed:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
