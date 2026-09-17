import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import {
  CLERK_SIGN_IN_PATH,
  CLERK_SIGN_UP_PATH,
  clerkSignInUrl,
} from "@/lib/clerk-auth-paths";
import {
  clerkAuthorizedParties,
  clerkFrontendApiProxyEnabled,
  parseClerkJwtKeyForMiddleware,
} from "@/lib/clerk-middleware-options";

const isPublicRoute = createRouteMatcher([
  "/",
  "/how-it-works",
  "/login(.*)",
  "/signup(.*)",
  "/api/webhooks/stripe(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks/shippo(.*)",
]);

const jwtKey = parseClerkJwtKeyForMiddleware();

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect({
        unauthenticatedUrl: clerkSignInUrl(request.url, request.url),
      });
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
    signInUrl: CLERK_SIGN_IN_PATH,
    signUpUrl: CLERK_SIGN_UP_PATH,
    /**
     * Proxy Clerk Frontend API through this app (`/__clerk`) on `*.vercel.app`.
     * Override with CLERK_FRONTEND_API_PROXY=true|false.
     */
    ...(clerkFrontendApiProxyEnabled()
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
