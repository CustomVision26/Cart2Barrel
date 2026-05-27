import "server-only";

import { purgeProfileByClerkUserId } from "@/data/purge-profile-by-clerk-user-id";

export async function syncProfileDeletedFromClerkWebhook(
  clerkUserId: string,
): Promise<void> {
  const id = clerkUserId?.trim();
  if (!id) return;

  try {
    await purgeProfileByClerkUserId(id);
  } catch (e) {
    console.error(
      "[Cart2Barrel] syncProfileDeletedFromClerkWebhook failed:",
      id,
      e,
    );
    throw e;
  }
}
