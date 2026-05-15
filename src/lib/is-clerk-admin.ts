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

export function isClerkAdmin(user: User | null): boolean {
  if (!user) return false;
  const role = user.publicMetadata?.role;
  if (typeof role !== "string") return false;
  return STAFF_ROLES.has(role);
}
