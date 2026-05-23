import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { getOrCreateProfile } from "@/data/profiles";

type ClerkWebhookUser = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

function primaryEmailFromClerkUser(user: ClerkWebhookUser): string | null {
  const emails = user.email_addresses ?? [];
  if (user.primary_email_address_id) {
    const primary = emails.find((e) => e.id === user.primary_email_address_id);
    if (primary?.email_address?.trim()) {
      return primary.email_address.trim();
    }
  }
  const first = emails[0]?.email_address?.trim();
  return first || null;
}

function fullNameFromClerkUser(user: ClerkWebhookUser): string | null {
  const parts = [user.first_name, user.last_name]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function syncProfileFromClerkWebhookUser(
  user: ClerkWebhookUser,
): Promise<void> {
  const clerkUserId = user.id?.trim();
  if (!clerkUserId) return;

  const email = primaryEmailFromClerkUser(user);
  const fullName = fullNameFromClerkUser(user);
  const now = new Date().toISOString();

  await getOrCreateProfile(clerkUserId, email);

  const db = getDb();
  await db
    .update(profiles)
    .set({
      updatedAt: now,
      ...(email != null ? { email } : {}),
      ...(fullName != null ? { fullName } : {}),
    })
    .where(eq(profiles.clerkUserId, clerkUserId));
}
