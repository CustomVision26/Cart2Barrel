import type { User } from "@clerk/nextjs/server";

/** Set `publicMetadata.role` to one of these values in Clerk for staff accounts. */
export const CLERK_ADMIN_ROLE = "admin" as const;
export const CLERK_SUPERADMIN_ROLE = "superadmin" as const;
export const CLERK_PLATFORM_ADMIN_ROLE = "platform_admin" as const;

const STAFF_ROLES = new Set<string>([
  CLERK_ADMIN_ROLE,
  CLERK_SUPERADMIN_ROLE,
  CLERK_PLATFORM_ADMIN_ROLE,
]);

export function clerkPublicMetadataRole(
  publicMetadata: User["publicMetadata"] | Record<string, unknown> | null | undefined,
): string | undefined {
  const role = publicMetadata?.role;
  return typeof role === "string" ? role : undefined;
}

export function isClerkStaffRole(role: string | undefined): boolean {
  return role != null && STAFF_ROLES.has(role);
}

export function isClerkAdmin(user: User | null): boolean {
  if (!user) return false;
  return isClerkStaffRole(clerkPublicMetadataRole(user.publicMetadata));
}
