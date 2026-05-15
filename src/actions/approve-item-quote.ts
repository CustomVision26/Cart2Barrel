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
import { getItemRequestById } from "@/data/item-requests";
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

  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");

  return { ok: true, message: "Added to cart." };
}
