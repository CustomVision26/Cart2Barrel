/** Display label for a profile row (name, then email, then Clerk id). */
export function profileDisplayName(params: {
  fullName?: string | null;
  email?: string | null;
  clerkUserId: string;
}): string {
  const name = params.fullName?.trim();
  const email = params.email?.trim();
  return name || email || params.clerkUserId;
}
