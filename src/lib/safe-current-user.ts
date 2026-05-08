import { currentUser } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";

function formatClerkFailure(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    if (Array.isArray(o.errors)) {
      const first = o.errors[0] as Record<string, unknown> | undefined;
      if (first && typeof first.longMessage === "string" && first.longMessage.trim()) {
        return first.longMessage.trim();
      }
      if (first && typeof first.message === "string" && first.message.trim()) {
        return first.message.trim();
      }
    }
  }
  if (e instanceof Error && e.message.trim()) {
    return e.message.trim();
  }
  return "Clerk could not load your session. Check CLERK_SECRET_KEY, your network connection, and try signing in again.";
}

export type SafeCurrentUserResult =
  | { ok: true; user: User | null }
  | { ok: false; message: string };

/**
 * {@link currentUser} calls Clerk's API and can throw. Use this in Server Components
 * where a failed Clerk request should render a message instead of a blank error.
 */
export async function safeCurrentUser(): Promise<SafeCurrentUserResult> {
  try {
    const user = await currentUser();
    return { ok: true, user };
  } catch (e) {
    return { ok: false, message: formatClerkFailure(e) };
  }
}
