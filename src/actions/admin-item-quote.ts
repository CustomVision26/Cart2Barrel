"use server";

import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import {
  insertItemQuoteForRequest,
  itemRequestSnapshotForQuote,
  patchItemRequestDisplayFieldsOnly,
  voidActiveQuotesForItemRequest,
} from "@/data/item-quotes";
import { ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT } from "@/lib/item-quote-void-reason";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseSaveAdminItemQuoteInput } from "@/lib/validations/admin-item-quote";

export type SaveAdminItemQuoteState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function saveAdminItemQuoteAction(
  raw: unknown
): Promise<SaveAdminItemQuoteState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = parseSaveAdminItemQuoteInput(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors, message: "Invalid quote payload." };
  }

  const d = parsed.data;

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
      line: lineSnapshotPayloadFromItemRequest(reqBefore),
    });

    await voidActiveQuotesForItemRequest(
      d.itemRequestId,
      ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT
    );
    let req = await getItemRequestById(d.itemRequestId);
    if (!req) {
      return { ok: false, message: "Item request not found after update." };
    }
    await patchItemRequestDisplayFieldsOnly(d.itemRequestId, {
      productName: req.productName?.trim() || null,
      productColor: d.productColor ?? null,
      productSize: d.productSize ?? null,
      ...(d.productImageUrl !== undefined
        ? { productImageUrl: d.productImageUrl }
        : {}),
    });
    req = await getItemRequestById(d.itemRequestId);
    if (!req) {
      return { ok: false, message: "Item request not found after update." };
    }
    const snap = itemRequestSnapshotForQuote(req);
    const newQuote = await insertItemQuoteForRequest(d.itemRequestId, {
      itemCost: d.itemCost,
      merchandiseSavingsCents,
      serviceFee: d.serviceFee,
      packingFeeCents: 0,
      estimatedShipping: d.estimatedShipping,
      totalPrice,
      merchandiseIncludesSiteShippingTax: d.merchandiseIncludesSiteShippingTax,
      staffNote: d.staffNote ?? null,
      ...snap,
    });
    await getDb()
      .update(itemRequests)
      .set({ status: "quoted" })
      .where(eq(itemRequests.id, d.itemRequestId));
    await insertItemRequestLineSnapshot({
      itemRequestId: d.itemRequestId,
      phase: "post_admin_estimate_edit",
      itemQuoteId: newQuote.id,
      line: lineSnapshotPayloadFromItemRequest(req),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save quote.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/cart");

  return { ok: true, message: "Quote saved. Earlier estimates stay in quote history." };
}
