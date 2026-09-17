/** App-hosted Clerk routes. Do not send users to accounts.*.vercel.app (no TLS). */
export const CLERK_SIGN_IN_PATH = "/login";
export const CLERK_SIGN_UP_PATH = "/signup";
export const CLERK_AFTER_AUTH_PATH = "/welcome";

export function clerkSignInUrl(requestUrl: string, returnTo?: string): string {
  const url = new URL(CLERK_SIGN_IN_PATH, requestUrl);
  if (returnTo) {
    url.searchParams.set("redirect_url", returnTo);
  }
  return url.toString();
}
