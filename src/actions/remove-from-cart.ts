"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import { getItemRequestById } from "@/data/item-requests";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { approveItemQuoteSchema } from "@/lib/validations/approve-item-quote";

export type RemoveFromCartState = {
  ok: boolean;
  message?: string;
};

export async function removeFromCartAction(
  raw: unknown
): Promise<RemoveFromCartState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = approveItemQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const request = await getItemRequestById(parsed.data.itemRequestId);
  if (!request || request.clerkUserId !== userId) {
    return { ok: false, message: "Not found." };
  }

  if (request.status !== "approved") {
    return { ok: false, message: "This item is not in your cart." };
  }

  const db = getDb();
  await db
    .update(itemRequests)
    .set({ status: "withdrawn" })
    .where(eq(itemRequests.id, request.id));

  await insertItemRequestLineSnapshot({
    itemRequestId: request.id,
    phase: "removed_from_cart",
    line: lineSnapshotPayloadFromItemRequest(request),
  });

  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/items/new");
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard");
  revalidatePath("/admin/item-requests");
  revalidatePath("/admin");

  return { ok: true, message: "Removed from cart." };
}
