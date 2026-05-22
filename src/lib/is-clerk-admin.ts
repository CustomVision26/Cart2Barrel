import type { User } from "@clerk/nextjs/server";

/** Set `publicMetadata.role` to one of these values in Clerk for staff accounts. */
export const CLERK_ADMIN_ROLE = "admin" as const;
export const CLERK_SUPERADMIN_ROLE = "superadmin" as const;
export const CLERK_PLATFORM_ADMIN_ROLE = "platform_admin" as const;

const STAFF_ROLES = new Set<string>([
  CLERK_ADMIN_ROLE,
  CLERK_SUPERADMIN_ROLE,
  CLERK_PLATFORM_ADMIN_ROLE,
  "administrator",
]);

export function clerkPublicMetadataRole(
  publicMetadata: User["publicMetadata"] | Record<string, unknown> | null | undefined,
): string | undefined {
  if (publicMetadata == null || typeof publicMetadata !== "object") {
    return undefined;
  }
  const meta = publicMetadata as Record<string, unknown>;
  const role = meta.role;
  if (typeof role === "string" && role.trim() !== "") {
    return role.trim();
  }
  if (meta.isAdmin === true || meta.is_admin === true) {
    return CLERK_ADMIN_ROLE;
  }
  const nested = meta.metadata;
  if (nested != null && typeof nested === "object") {
    const nestedRole = (nested as Record<string, unknown>).role;
    if (typeof nestedRole === "string" && nestedRole.trim() !== "") {
      return nestedRole.trim();
    }
  }
  return undefined;
}

export function isClerkStaffRole(role: string | undefined): boolean {
  if (role == null || role.trim() === "") return false;
  return STAFF_ROLES.has(role.trim().toLowerCase());
}

export function isClerkAdmin(user: User | null): boolean {
  if (!user) return false;
  return isClerkStaffRole(clerkPublicMetadataRole(user.publicMetadata));
}
