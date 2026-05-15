"use server";

import { currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import { batchQuoteEstimates, batchQuoteSessions } from "@/db/schema";
import {
  auditMemoLinesForBatch,
  collectLatestQuotesForRequests,
  detachItemRequestsFromBatchSession,
  insertBatchEstimateRow,
  listItemRequestsForBatchSession,
  markSessionEstimated,
  sumBatchTotalsFromQuotes,
  voidActiveEstimatesForSession,
} from "@/data/batch-quote-sessions";
import { insertItemRequestLineSnapshot, lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import { saveAdminBatchQuoteEstimateSchema } from "@/lib/validations/batch-quote";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

const draftSchema = z.object({
  batchSessionId: z.string().uuid(),
});

export type AdminBatchQuoteDraftLine = {
  itemRequestId: string;
  productName: string | null;
  itemCost: number;
  serviceFee: number;
  estimatedShipping: number;
  taxCents: number;
  totalPrice: number;
};

export type GetAdminBatchQuoteEstimateDraftResult =
  | {
      ok: true;
      batchNumber: string;
      siteKey: string;
      status: "submitted" | "estimated";
      sessionId: string;
      lines: AdminBatchQuoteDraftLine[];
      batchMerchandiseTotalCents: number;
      serviceHandlingTotalCents: number;
      batchShippingTotalCents: number;
      batchSaleTaxTotalCents: number;
      existingSiteMerchandiseCents: number | null;
      existingSiteShippingCents: number | null;
      existingSiteSaleTaxCents: number | null;
    }
  | { ok: false; message: string };

export async function getAdminBatchQuoteEstimateDraftAction(
  raw: unknown
): Promise<GetAdminBatchQuoteEstimateDraftResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid session." };
  }

  const db = getDb();
  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(eq(batchQuoteSessions.id, parsed.data.batchSessionId))
    .limit(1);
  if (!session) return { ok: false, message: "Batch not found." };
  if (session.status !== "submitted" && session.status !== "estimated") {
    return { ok: false, message: "This batch is not ready for an estimate." };
  }

  const requests = await listItemRequestsForBatchSession(session.id);
  const quoteMap = await collectLatestQuotesForRequests(
    requests.map((r) => r.id)
  );
  const quotes = requests.map((r) => quoteMap.get(r.id)).filter(Boolean);
  if (quotes.length !== requests.length) {
    return { ok: false, message: "Every line must have an active quote first." };
  }

  const safeQuotes = quotes as NonNullable<(typeof quotes)[number]>[];
  const sums = sumBatchTotalsFromQuotes(safeQuotes);

  const lines: AdminBatchQuoteDraftLine[] = requests.map((req) => {
    const q = quoteMap.get(req.id)!;
    return {
      itemRequestId: req.id,
      productName: req.productName?.trim() || null,
      itemCost: q.itemCost,
      serviceFee: q.serviceFee,
      estimatedShipping: q.estimatedShipping,
      taxCents: lineSaleTaxCentsFromQuote(q),
      totalPrice: q.totalPrice,
    };
  });

  const [latestSavedEstimate] = await db
    .select()
    .from(batchQuoteEstimates)
    .where(eq(batchQuoteEstimates.batchQuoteSessionId, session.id))
    .orderBy(desc(batchQuoteEstimates.createdAt))
    .limit(1);

  return {
    ok: true,
    batchNumber: session.batchNumber,
    siteKey: session.siteKey,
    status: session.status,
    sessionId: session.id,
    lines,
    batchMerchandiseTotalCents: sums.batchMerchandiseTotalCents,
    serviceHandlingTotalCents: sums.serviceHandlingTotalCents,
    batchShippingTotalCents: sums.batchShippingTotalCents,
    batchSaleTaxTotalCents: sums.batchSaleTaxTotalCents,
    existingSiteMerchandiseCents:
      latestSavedEstimate?.siteMerchandiseTotalCents ?? null,
    existingSiteShippingCents:
      latestSavedEstimate?.siteShippingTotalCents ?? null,
    existingSiteSaleTaxCents: latestSavedEstimate?.siteSaleTaxTotalCents ?? null,
  };
}

export type SaveAdminBatchQuoteEstimateState = {
  ok: boolean;
  message?: string;
};

export async function saveAdminBatchQuoteEstimateAction(
  raw: unknown
): Promise<SaveAdminBatchQuoteEstimateState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = saveAdminBatchQuoteEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid estimate payload." };
  }

  const { batchSessionId, siteMerchandiseCents, siteShippingCents, siteSaleTaxCents } =
    parsed.data;

  const db = getDb();
  const [session] = await db
    .select()
    .from(batchQuoteSessions)
    .where(eq(batchQuoteSessions.id, batchSessionId))
    .limit(1);
  if (!session) return { ok: false, message: "Batch not found." };
  if (session.status !== "submitted" && session.status !== "estimated") {
    return { ok: false, message: "Cannot save estimate for this batch." };
  }

  const requests = await listItemRequestsForBatchSession(session.id);
  const quoteMap = await collectLatestQuotesForRequests(
    requests.map((r) => r.id)
  );
  const quotes = requests.map((r) => quoteMap.get(r.id)).filter(Boolean);
  if (quotes.length !== requests.length) {
    return { ok: false, message: "Every line must have an active quote first." };
  }

  const safeQuotes = quotes as NonNullable<(typeof quotes)[number]>[];
  const sums = sumBatchTotalsFromQuotes(safeQuotes);

  const itemDiscountCents = Math.max(
    0,
    sums.batchMerchandiseTotalCents - siteMerchandiseCents
  );
  const shippingDiscountCents = Math.max(
    0,
    sums.batchShippingTotalCents - siteShippingCents
  );
  const saleTaxDiscountCents = Math.max(
    0,
    sums.batchSaleTaxTotalCents - siteSaleTaxCents
  );
  const subtotalCents =
    siteMerchandiseCents +
    sums.serviceHandlingTotalCents +
    siteSaleTaxCents +
    siteShippingCents;

  try {
    await voidActiveEstimatesForSession(session.id);
    const estimate = await insertBatchEstimateRow({
      sessionId: session.id,
      batchMerchandiseTotalCents: sums.batchMerchandiseTotalCents,
      siteMerchandiseTotalCents: siteMerchandiseCents,
      itemDiscountCents,
      serviceHandlingTotalCents: sums.serviceHandlingTotalCents,
      batchShippingTotalCents: sums.batchShippingTotalCents,
      siteShippingTotalCents: siteShippingCents,
      shippingDiscountCents,
      batchSaleTaxTotalCents: sums.batchSaleTaxTotalCents,
      siteSaleTaxTotalCents: siteSaleTaxCents,
      saleTaxDiscountCents,
      subtotalCents,
    });

    const sharedMemoParams = {
      batchNumber: session.batchNumber,
      estimateId: estimate.id,
      batchMerchandiseTotalCents: sums.batchMerchandiseTotalCents,
      siteMerchandiseTotalCents: siteMerchandiseCents,
      itemDiscountCents,
      serviceHandlingTotalCents: sums.serviceHandlingTotalCents,
      batchShippingTotalCents: sums.batchShippingTotalCents,
      siteShippingTotalCents: siteShippingCents,
      shippingDiscountCents,
      batchSaleTaxTotalCents: sums.batchSaleTaxTotalCents,
      siteSaleTaxTotalCents: siteSaleTaxCents,
      saleTaxDiscountCents,
      subtotalCents,
    };

    const customerMemo = auditMemoLinesForBatch({
      ...sharedMemoParams,
      audience: "customer",
    });
    const adminMemo = auditMemoLinesForBatch({
      ...sharedMemoParams,
      audience: "admin",
    });

    for (const req of requests) {
      const line = lineSnapshotPayloadFromItemRequest(req);
      await insertItemRequestLineSnapshot({
        itemRequestId: req.id,
        phase: "batch_estimate_customer_copy",
        batchQuoteSessionId: session.id,
        auditMemo: customerMemo,
        line,
      });
      await insertItemRequestLineSnapshot({
        itemRequestId: req.id,
        phase: "batch_estimate_admin_copy",
        batchQuoteSessionId: session.id,
        auditMemo: adminMemo,
        line,
      });
    }

    await markSessionEstimated(session.id, estimate);
    await detachItemRequestsFromBatchSession(session.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save batch estimate.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/item-requests/batch-items/batch-history");
  revalidatePath("/admin/item-requests/batch-items/batch-estimates");
  revalidatePath("/admin/item-requests/batch-items/submitted");
  revalidatePath("/admin");
  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();

  return { ok: true, message: "Batch estimate saved. Customer lines are back on Products." };
}
