import { clerkClient } from "@clerk/nextjs/server";

import {
  CLERK_ADMIN_ROLE,
  clerkPublicMetadataRole,
  isClerkStaffRole,
} from "@/lib/is-clerk-admin";

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
  return "Clerk could not update the user role.";
}

export async function getClerkStaffRoleForUser(
  clerkUserId: string,
): Promise<string | undefined> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkUserId);
    return clerkPublicMetadataRole(user.publicMetadata);
  } catch {
    return undefined;
  }
}

export async function grantClerkAdminRole(
  clerkUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existing = await getClerkStaffRoleForUser(clerkUserId);
  if (isClerkStaffRole(existing)) {
    return {
      ok: false,
      message:
        "This user already has admin access in Clerk (check public metadata role).",
    };
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { role: CLERK_ADMIN_ROLE },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: formatClerkFailure(e) };
  }
}
