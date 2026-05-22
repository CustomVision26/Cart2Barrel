import { clerkClient } from "@clerk/nextjs/server";
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
  return "Clerk could not update this account.";
}

export function isClerkUserBanned(user: User): boolean {
  return Boolean((user as User & { banned?: boolean }).banned);
}

const CLERK_LOOKUP_CHUNK = 20;

export async function clerkBannedStatusByUserIds(
  clerkUserIds: string[],
): Promise<Map<string, boolean>> {
  const status = new Map<string, boolean>();
  if (clerkUserIds.length === 0) return status;

  try {
    const client = await clerkClient();
    for (let i = 0; i < clerkUserIds.length; i += CLERK_LOOKUP_CHUNK) {
      const chunk = clerkUserIds.slice(i, i + CLERK_LOOKUP_CHUNK);
      await Promise.all(
        chunk.map(async (id) => {
          try {
            const user = await client.users.getUser(id);
            status.set(id, isClerkUserBanned(user));
          } catch {
            status.set(id, false);
          }
        }),
      );
    }
  } catch {
    for (const id of clerkUserIds) {
      status.set(id, false);
    }
  }

  return status;
}

export async function banClerkUser(
  clerkUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const client = await clerkClient();
    await client.users.banUser(clerkUserId);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: formatClerkFailure(e) };
  }
}

export async function unbanClerkUser(
  clerkUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const client = await clerkClient();
    await client.users.unbanUser(clerkUserId);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: formatClerkFailure(e) };
  }
}
