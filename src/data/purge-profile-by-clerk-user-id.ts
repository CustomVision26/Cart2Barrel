import "server-only";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { getProfileByClerkId } from "@/data/profiles";
import { getDb } from "@/db";
import { orders, payments, profiles } from "@/db/schema";

function revalidateAfterProfilePurge(): void {
  revalidateTag("admin-profile-picker", "max");
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin/users/all-users");
  revalidatePath("/admin/users/assign-admin");
  revalidatePath("/admin/users/grant-log");
  revalidatePath("/admin/support/inbox");
  revalidatePath("/admin", "layout");
}

/**
 * Removes a shopper's profile and all DB rows tied to them.
 * Orders and payments use `restrict` on `profiles` — delete those before the profile row.
 */
export async function purgeProfileByClerkUserId(
  clerkUserId: string,
): Promise<boolean> {
  const id = clerkUserId?.trim();
  if (!id) return false;

  const existing = await getProfileByClerkId(id);
  if (!existing) return false;

  const db = getDb();

  await db.delete(payments).where(eq(payments.clerkUserId, id));
  await db.delete(orders).where(eq(orders.clerkUserId, id));
  await db.delete(profiles).where(eq(profiles.clerkUserId, id));

  revalidateAfterProfilePurge();
  return true;
}
