"use server";

import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemQuotes, outsidePurchaseReturnRequests } from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { getLatestQuoteForItemRequest } from "@/data/item-quotes";
import { formatUsd } from "@/lib/admin-markup";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { stripSupersededReturnEstimateNoteContent } from "@/lib/outside-purchase-staff-note-display";
import { isMissingOutsidePurchaseReturnRequestsTableError } from "@/lib/db-column-missing";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { recordOutsidePurchaseReturnEstimateReadyActivity } from "@/data/user-status-update-events";
import { adminOutsidePurchaseReturnEstimateSchema } from "@/lib/validations/outside-purchase-return-request";

export type AdminOutsidePurchaseReturnEstimateState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function publishAdminOutsidePurchaseReturnEstimateAction(
  raw: unknown,
): Promise<AdminOutsidePurchaseReturnEstimateState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminOutsidePurchaseReturnEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid estimate." };
  }

  const {
    itemRequestId,
    returnServiceFeeCents,
    returnTransitFeeCents = 0,
    returnStaffNote,
  } = parsed.data;
  const req = await getItemRequestById(itemRequestId);
  if (!req || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Outside-purchase product not found." };
  }

  const returnReq = await getOutsidePurchaseReturnRequestByItemRequestId(req.id);
  if (!returnReq || returnReq.status === "cancelled" || returnReq.status === "paid") {
    return { ok: false, message: "No active return request for this line." };
  }

  const quote = await getLatestQuoteForItemRequest(req.id);
  if (!quote) {
    return { ok: false, message: "No quote row to attach the return estimate." };
  }

  const now = new Date().toISOString();
  const db = getDb();
  const baseFeeCents = Math.max(0, returnServiceFeeCents - returnTransitFeeCents);
  const feeLine =
    returnTransitFeeCents > 0 ?
      `Return service & handling: ${formatUsd(baseFeeCents)} + transit ${formatUsd(returnTransitFeeCents)} = ${formatUsd(returnServiceFeeCents)} (customer pays before carrier drop-off).`
    : `Return service & handling: ${formatUsd(returnServiceFeeCents)} (customer pays before carrier drop-off).`;
  const baseStaffNote = stripSupersededReturnEstimateNoteContent(
    quote.staffNote?.trim() ?? "",
  );
  const mergedStaffNote = [baseStaffNote, returnStaffNote, feeLine]
    .filter(Boolean)
    .join("\n\n");

  try {
    await db
      .update(outsidePurchaseReturnRequests)
      .set({
        status: "estimate_ready",
        returnServiceFeeCents,
        returnStaffNote: returnStaffNote ?? null,
        estimateReadyAt: now,
        updatedAt: now,
      })
      .where(eq(outsidePurchaseReturnRequests.id, returnReq.id));

    await db
      .update(itemQuotes)
      .set({
        serviceFee: returnServiceFeeCents,
        totalPrice: returnServiceFeeCents,
        staffNote: mergedStaffNote,
      })
      .where(eq(itemQuotes.id, quote.id));

    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "outside_purchase_return_estimate_ready",
      itemQuoteId: quote.id,
      line: lineSnapshotPayloadFromItemRequest(req),
      auditMemo: `Return estimate published · ${formatUsd(returnServiceFeeCents)}`,
    });
  } catch (e) {
    if (isMissingOutsidePurchaseReturnRequestsTableError(e)) {
      return {
        ok: false,
        message:
          "Return requests are not available yet — run npm run db:push to apply migration 0047_outside_purchase_return_requests.",
      };
    }
    throw e;
  }

  await recordOutsidePurchaseReturnEstimateReadyActivity({
    clerkUserId: req.clerkUserId,
    itemRequestId: req.id,
    productName: req.productName,
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: `Return estimate published (${formatUsd(returnServiceFeeCents)}). Customer can preview and accept.`,
  };
}
