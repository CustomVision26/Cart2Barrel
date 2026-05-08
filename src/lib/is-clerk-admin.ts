import type { User } from "@clerk/nextjs/server";

/** Set `publicMetadata.role` to this value in Clerk for staff accounts. */
export const CLERK_ADMIN_ROLE = "admin" as const;

export function isClerkAdmin(user: User | null): boolean {
  if (!user) return false;
  const role = user.publicMetadata?.role;
  return role === CLERK_ADMIN_ROLE;
}
