import { auth } from "@clerk/nextjs/server";
import type { User } from "@clerk/nextjs/server";
import { cache } from "react";

import {
  clerkPublicMetadataRole,
  isClerkStaffRole,
} from "@/lib/is-clerk-admin";
import {
  safeCurrentUser,
  type SafeCurrentUserResult,
} from "@/lib/safe-current-user";

export type ClerkSessionGate =
  | { ok: false; message: string }
  | {
      ok: true;
      userId: string;
      isAdmin: boolean;
      /** Set when read from the session JWT (no Clerk Backend API call). */
      roleFromSession?: string;
    };

function readRoleFromSessionClaims(
  sessionClaims: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!sessionClaims) return undefined;

  const direct = sessionClaims.role;
  if (typeof direct === "string") return direct;

  const publicMetadata = sessionClaims.public_metadata ?? sessionClaims.publicMetadata;
  if (publicMetadata && typeof publicMetadata === "object") {
    return clerkPublicMetadataRole(publicMetadata as Record<string, unknown>);
  }

  const metadata = sessionClaims.metadata;
  if (metadata && typeof metadata === "object") {
    return clerkPublicMetadataRole(metadata as Record<string, unknown>);
  }

  return undefined;
}

/** One Clerk Backend API user fetch per request (layouts, pages, actions). */
export const getCachedClerkUser = cache(
  async (): Promise<SafeCurrentUserResult> => safeCurrentUser(),
);

/**
 * Fast session gate for layouts: uses JWT session claims when `role` is present,
 * otherwise falls back to a single cached {@link currentUser} call.
 */
export const getClerkSessionGate = cache(async (): Promise<ClerkSessionGate> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const roleFromSession = readRoleFromSessionClaims(
    sessionClaims as Record<string, unknown> | null | undefined,
  );
  if (roleFromSession !== undefined) {
    return {
      ok: true,
      userId,
      isAdmin: isClerkStaffRole(roleFromSession),
      roleFromSession,
    };
  }

  const cu = await getCachedClerkUser();
  if (!cu.ok) {
    return { ok: false, message: cu.message };
  }

  return {
    ok: true,
    userId,
    isAdmin: cu.user != null && isClerkStaffRole(clerkPublicMetadataRole(cu.user.publicMetadata)),
  };
});

/** Resolves a Clerk user for admin data loaders (cached once per request). */
export async function getClerkUserForAdminData(
  gate: Extract<ClerkSessionGate, { ok: true }>,
): Promise<User | null> {
  if (!gate.isAdmin) return null;
  const cu = await getCachedClerkUser();
  return cu.ok ? cu.user : null;
}
