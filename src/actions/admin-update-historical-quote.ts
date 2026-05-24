"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import {
  getItemQuoteById,
  insertItemQuoteForRequest,
  itemRequestSnapshotForQuote,
  patchItemRequestDisplayFieldsOnly,
  voidActiveQuotesForItemRequest,
} from "@/data/item-quotes";
import { ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT } from "@/lib/item-quote-void-reason";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseAdminUpdateHistoricalQuoteInput } from "@/lib/validations/admin-update-historical-quote";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type AdminUpdateHistoricalQuoteState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function adminUpdateHistoricalQuoteAction(
  raw: unknown
): Promise<AdminUpdateHistoricalQuoteState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = parseAdminUpdateHistoricalQuoteInput(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors, message: "Invalid payload." };
  }

  const d = parsed.data;
  const adminClerkUserId = user!.id;
  const existing = await getItemQuoteById(d.quoteId);
  if (!existing || existing.itemRequestId !== d.itemRequestId) {
    return { ok: false, message: "Quote not found." };
  }

  try {
    const reqBefore = await getItemRequestById(d.itemRequestId);
    if (!reqBefore) {
      return { ok: false, message: "Item request not found." };
    }
    const totalPrice = d.itemCost + d.serviceFee + d.estimatedShipping + d.tax;
    const merchandiseSavingsCents =
      d.merchandiseSavingsCents != null && d.merchandiseSavingsCents > 0
        ? d.merchandiseSavingsCents
        : null;
    await insertItemRequestLineSnapshot({
      itemRequestId: d.itemRequestId,
      phase: "pre_admin_estimate_edit",
      recordedByClerkUserId: adminClerkUserId,
      line: lineSnapshotPayloadFromItemRequest(reqBefore),
    });

    await patchItemRequestDisplayFieldsOnly(d.itemRequestId, {
      productName: d.productName ?? null,
      productColor: d.productColor ?? null,
      productSize: d.productSize ?? null,
      quantity: d.quantity,
      ...(d.productImageUrl !== undefined
        ? { productImageUrl: d.productImageUrl }
        : {}),
    });
    await voidActiveQuotesForItemRequest(
      d.itemRequestId,
      ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT
    );
    const reqAfter = await getItemRequestById(d.itemRequestId);
    if (!reqAfter) {
      return { ok: false, message: "Item request not found after update." };
    }
    const snap = itemRequestSnapshotForQuote(reqAfter);
    const newQuote = await insertItemQuoteForRequest(d.itemRequestId, {
      itemCost: d.itemCost,
      merchandiseSavingsCents,
      serviceFee: d.serviceFee,
      packingFeeCents: 0,
      estimatedShipping: d.estimatedShipping,
      totalPrice,
      merchandiseIncludesSiteShippingTax: d.merchandiseIncludesSiteShippingTax,
      staffNote: d.staffNote ?? null,
      recordedByClerkUserId: adminClerkUserId,
      ...snap,
    });
    await insertItemRequestLineSnapshot({
      itemRequestId: d.itemRequestId,
      phase: "post_admin_estimate_edit",
      itemQuoteId: newQuote.id,
      recordedByClerkUserId: adminClerkUserId,
      line: lineSnapshotPayloadFromItemRequest(reqAfter),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/cart");

  return {
    ok: true,
    message: "Quote saved. Previous estimates are kept in history as superseded.",
  };
}
