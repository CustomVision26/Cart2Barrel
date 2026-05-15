import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { clerkAuthorizedParties } from "@/lib/clerk-middleware-options";

const isPublicRoute = createRouteMatcher([
  "/",
  "/how-it-works",
  "/login(.*)",
  "/signup(.*)",
  "/api/webhooks/stripe(.*)",
]);

const rawJwt = process.env.CLERK_JWT_KEY?.trim();
const jwtKey = rawJwt?.replace(/\\n/g, "\n");

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  },
  {
    /**
     * PEM public key from Clerk Dashboard → API keys → Show JWT public key.
     * Verifies session JWTs without Edge calling Clerk’s JWKS URL (fixes `fetch failed` /
     * handshake errors when outbound fetch from the proxy is blocked or flaky).
     */
    ...(jwtKey ? { jwtKey } : {}),
    authorizedParties: clerkAuthorizedParties(),
    /**
     * Only enable when browsers truly cannot reach Clerk directly. If enabled without
     * matching Clerk Dashboard + client proxy setup, APIs may return `host_invalid`.
     * Set CLERK_FRONTEND_API_PROXY=true to turn on.
     */
    ...(process.env.CLERK_FRONTEND_API_PROXY === "true"
      ? { frontendApiProxy: { enabled: true } as const }
      : {}),
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    /** Required so Clerk Frontend API handshakes succeed (Next.js 16 `proxy.ts`). */
    "/__clerk/(.*)",
  ],
};
