"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  batchQuoteSessions,
  batchQuoteSessionLines,
  itemRequests,
} from "@/db/schema";
import { getItemRequestById } from "@/data/item-requests";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import {
  removeFromCartLineSchema,
  type RemoveFromCartLineInput,
} from "@/lib/validations/remove-from-cart-item";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type RemoveFromCartState = {
  ok: boolean;
  message?: string;
};

export async function removeFromCartAction(
  raw: unknown,
): Promise<RemoveFromCartState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = removeFromCartLineSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { itemRequestId, disposition }: RemoveFromCartLineInput =
    parsed.data;

  const request = await getItemRequestById(itemRequestId);
  if (!request || request.clerkUserId !== userId) {
    return { ok: false, message: "Not found." };
  }

  if (request.status !== "approved") {
    return { ok: false, message: "This item is not in your cart." };
  }

  const db = getDb();

  const linkRows = await db
    .select({
      sid: batchQuoteSessionLines.batchQuoteSessionId,
    })
    .from(batchQuoteSessionLines)
    .where(eq(batchQuoteSessionLines.itemRequestId, itemRequestId))
    .limit(1);

  if (linkRows[0]?.sid) {
    const [batchSess] = await db
      .select({
        cartAcceptanceAcceptedAt: batchQuoteSessions.cartAcceptanceAcceptedAt,
        status: batchQuoteSessions.status,
      })
      .from(batchQuoteSessions)
      .where(
        and(
          eq(batchQuoteSessions.id, linkRows[0].sid),
          eq(batchQuoteSessions.clerkUserId, userId),
        ),
      )
      .limit(1);

    if (
      batchSess?.cartAcceptanceAcceptedAt ||
      batchSess?.status === "in_cart"
    ) {
      return {
        ok: false,
        message:
          "This request is part of an accepted batch. Remove the bundle using the batch card in your cart.",
      };
    }
  }

  const nextStatus = disposition === "permanent_remove" ? "withdrawn" : "quoted";

  await db
    .update(itemRequests)
    .set({ status: nextStatus })
    .where(eq(itemRequests.id, request.id));

  if (disposition === "permanent_remove") {
    await insertItemRequestLineSnapshot({
      itemRequestId: request.id,
      phase: "removed_from_cart",
      line: lineSnapshotPayloadFromItemRequest(request),
    });
  }

  revalidatePath("/dashboard/cart");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin");

  return {
    ok: true,
    message:
      disposition === "permanent_remove"
        ? "Product permanently removed."
        : "Product returned to your requests list as quoted.",
  };
}
