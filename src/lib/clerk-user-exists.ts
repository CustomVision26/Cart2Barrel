import { clerkClient } from "@clerk/nextjs/server";

function isClerkUserNotFoundError(e: unknown): boolean {
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    if (o.status === 404) return true;
    if (Array.isArray(o.errors)) {
      const first = o.errors[0] as Record<string, unknown> | undefined;
      if (first?.code === "resource_not_found") return true;
    }
  }
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return msg.includes("not found") || msg.includes("404");
}

/** `true` if the Clerk user exists, `false` if deleted, `null` if Clerk could not be checked. */
export async function clerkUserExists(
  clerkUserId: string,
): Promise<boolean | null> {
  try {
    const client = await clerkClient();
    await client.users.getUser(clerkUserId);
    return true;
  } catch (e) {
    if (isClerkUserNotFoundError(e)) {
      return false;
    }
    return null;
  }
}
