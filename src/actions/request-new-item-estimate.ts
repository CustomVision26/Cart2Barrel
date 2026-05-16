"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { voidActiveQuotesForItemRequest } from "@/data/item-quotes";
import {
  getItemRequestById,
  resetQuotedRequestToPendingForRework,
} from "@/data/item-requests";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION } from "@/lib/item-quote-void-reason";
import { parseCustomerItemRequestLineDetails } from "@/lib/validations/customer-item-request-line-details";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type RequestNewItemEstimateState = {
  ok: boolean;
  message?: string;
};

/**
 * Customer saves line details, clears stored quotes, and moves request back to pending
 * so staff can issue a new estimate.
 */
export async function requestNewItemEstimateAction(
  raw: unknown
): Promise<RequestNewItemEstimateState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = parseCustomerItemRequestLineDetails(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid details." };
  }

  const d = parsed.data;

  const reset = await resetQuotedRequestToPendingForRework(
    d.itemRequestId,
    userId,
    {
      quantity: d.quantity,
      productSize: d.productSize,
      productColor: d.productColor,
    }
  );

  if (!reset) {
    return {
      ok: false,
      message:
        "Could not submit. A new estimate can only be requested for items that are currently quoted.",
    };
  }

  try {
    await voidActiveQuotesForItemRequest(
      d.itemRequestId,
      ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION
    );
  } catch {
    return {
      ok: false,
      message:
        "Request was updated but archiving the previous estimate failed. Contact support.",
    };
  }

  const row = await getItemRequestById(d.itemRequestId);
  if (row && row.clerkUserId === userId) {
    await insertItemRequestLineSnapshot({
      itemRequestId: row.id,
      phase: "customer_line_edit",
      line: lineSnapshotPayloadFromItemRequest(row),
    });
  }

  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");

  return {
    ok: true,
    message:
      "Your updates were sent. The previous estimate was kept for reference. Staff will prepare a new quote.",
  };
}
