"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import {
  getLatestQuoteForItemRequest,
  restoreOrphanQuotedItemRequestQuote,
} from "@/data/item-quotes";
import { insertOutsidePurchaseLifecycleSnapshot } from "@/data/outside-purchase-lifecycle-snapshot";
import { getItemRequestById } from "@/data/item-requests";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { approveItemQuoteSchema } from "@/lib/validations/approve-item-quote";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type ApproveItemQuoteState = {
  ok: boolean;
  message?: string;
};

export async function approveItemQuoteAction(
  raw: unknown
): Promise<ApproveItemQuoteState> {
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

  if (request.status !== "quoted") {
    return {
      ok: false,
      message:
        request.status === "approved"
          ? "This estimate is already in your cart."
          : "Only quoted items can be accepted.",
    };
  }

  if (
    isOutsidePurchaseRequest(request) &&
    !request.outsidePurchasePublishedAt
  ) {
    return {
      ok: false,
      message: "This outside purchase is not available yet. Contact support.",
    };
  }

  let quote = await getLatestQuoteForItemRequest(request.id);
  if (!quote) {
    quote = await restoreOrphanQuotedItemRequestQuote(request.id);
  }
  if (!quote) {
    return {
      ok: false,
      message:
        "No active estimate on file. Ask staff to open your request in admin and save the quote again.",
    };
  }

  const db = getDb();
  await db
    .update(itemRequests)
    .set({ status: "approved" })
    .where(eq(itemRequests.id, request.id));

  if (isOutsidePurchaseRequest(request)) {
    await insertOutsidePurchaseLifecycleSnapshot({
      request: { ...request, status: "approved" },
      phase: "outside_purchase_added_to_cart",
      itemQuoteId: quote.id,
      auditMemo:
        "Customer accepted estimate and added this outside purchase to cart (service & handling).",
    });
  }

  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");

  return { ok: true, message: "Added to cart." };
}
