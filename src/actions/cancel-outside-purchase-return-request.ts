"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemQuotes, itemRequests, outsidePurchaseReturnRequests } from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { getLatestQuoteForItemRequest } from "@/data/item-quotes";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { formatUsd } from "@/lib/admin-markup";
import { isMissingOutsidePurchaseReturnRequestsTableError } from "@/lib/db-column-missing";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  computeOutsidePurchaseCustomerQuoteCents,
  parseListedUnitPriceCentsFromOutsidePurchaseStaffNote,
  parseOutsidePurchaseUnitsPerPackFromStaffNote,
} from "@/lib/outside-purchase-service-quote";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { cancelOutsidePurchaseReturnRequestSchema } from "@/lib/validations/outside-purchase-return-request";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

export type CancelOutsidePurchaseReturnRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function cancelOutsidePurchaseReturnRequestAction(
  raw: unknown,
): Promise<CancelOutsidePurchaseReturnRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to cancel the return request." };
  }

  const parsed = cancelOutsidePurchaseReturnRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const req = await getItemRequestById(parsed.data.itemRequestId);
  if (!req || req.clerkUserId !== userId || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Product not found." };
  }

  const returnReq = await getOutsidePurchaseReturnRequestByItemRequestId(req.id);
  if (
    !returnReq ||
    returnReq.status === "cancelled" ||
    returnReq.status === "paid" ||
    returnReq.status === "submitted"
  ) {
    return {
      ok: false,
      message: "This return request cannot be cancelled from your account right now.",
    };
  }

  const quote = await getLatestQuoteForItemRequest(req.id);
  if (!quote) {
    return { ok: false, message: "No estimate on file for this product." };
  }

  const condition = req.outsidePurchaseReceivedCondition as WarehouseReceiveCondition | null;
  const conditionLabel =
    condition ? warehouseReceiveConditionLabel(condition) : "problem receipt";

  const unitPriceCents =
    parseListedUnitPriceCentsFromOutsidePurchaseStaffNote(quote.staffNote) ?? 0;
  const unitsPerPack =
    parseOutsidePurchaseUnitsPerPackFromStaffNote(quote.staffNote) ?? 1;
  const pricing = await getMerchantPricingForEstimates(req.clerkUserId).then((fees) =>
    computeOutsidePurchaseCustomerQuoteCents({
      unitPriceCents,
      quantity: req.quantity,
      unitsPerPack,
      serviceTiers: fees.serviceTiers,
    }),
  );

  const now = new Date().toISOString();
  const db = getDb();

  try {
    await db
      .update(outsidePurchaseReturnRequests)
      .set({
        status: "cancelled",
        updatedAt: now,
      })
      .where(eq(outsidePurchaseReturnRequests.id, returnReq.id));

    await db
      .update(itemRequests)
      .set({ outsidePurchasePaymentPromptedAt: null })
      .where(eq(itemRequests.id, req.id));

    await db
      .update(itemQuotes)
      .set({
        serviceFee: pricing.serviceFeeCents,
        totalPrice: pricing.totalPriceCents,
      })
      .where(eq(itemQuotes.id, quote.id));

    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "outside_purchase_return_cancelled",
      itemQuoteId: quote.id,
      line: lineSnapshotPayloadFromItemRequest(req),
      auditMemo: `Customer cancelled return-to-retailer request · reverted to Received: ${conditionLabel} · ${formatUsd(pricing.totalPriceCents)} service & handling`,
    });
  } catch (e) {
    if (isMissingOutsidePurchaseReturnRequestsTableError(e)) {
      return {
        ok: false,
        message:
          "Return workflow is not available yet — run npm run db:push to apply migration 0047_outside_purchase_return_requests.",
      };
    }
    throw e;
  }

  revalidateDashboardAddItem();
  revalidatePath("/admin/item-requests", "layout");

  return {
    ok: true,
    message: `Return request cancelled. This line is back to Received: ${conditionLabel}.`,
  };
}
