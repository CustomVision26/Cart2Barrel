"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  createDraftBatchSessionForOwner,
  removeItemRequestsFromOwnerDraftBatchSession,
  requestEstimatedBatchRevisionForOwner,
  submitDraftBatchSessionForOwner,
  withdrawEstimatedBatchQuoteSessionForOwner,
  withdrawSubmittedBatchQuoteSessionForOwner,
} from "@/data/batch-quote-sessions";
import {
  createCustomerBatchQuoteSchema,
  removeDraftBatchProductsSchema,
  requestBatchEstimateRevisionSchema,
  submitCustomerBatchQuoteSchema,
  withdrawQuotedBatchSessionSchema,
  withdrawSubmittedBatchSessionSchema,
} from "@/lib/validations/batch-quote";
import { isMissingBatchCartAcceptanceColumnsError } from "@/lib/db-column-missing";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type CustomerBatchQuoteState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function createCustomerBatchQuoteAction(
  raw: unknown
): Promise<CustomerBatchQuoteState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = createCustomerBatchQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid batch selection.", fieldErrors: {} };
  }

  try {
    await createDraftBatchSessionForOwner({
      clerkUserId: userId,
      itemRequestIds: parsed.data.itemRequestIds,
    });
  } catch (e) {
    if (isMissingBatchCartAcceptanceColumnsError(e)) {
      return {
        ok: false,
        message:
          "Your database is missing the latest batch columns (cart acceptance). From the project folder run `npm run db:push` or `npm run db:migrate`, then try Add Batch again.",
      };
    }
    const msg = e instanceof Error ? e.message : "Could not create batch.";
    return { ok: false, message: msg };
  }

  revalidateDashboardAddItem();
  return { ok: true, message: "Batch added under Batch Quotes." };
}

export async function submitCustomerBatchQuoteAction(
  raw: unknown
): Promise<CustomerBatchQuoteState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = submitCustomerBatchQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid batch." };
  }

  try {
    await submitDraftBatchSessionForOwner({
      sessionId: parsed.data.batchSessionId,
      clerkUserId: userId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit batch.";
    return { ok: false, message: msg };
  }

  revalidateDashboardAddItem();
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/item-requests/batch-items/batch-history");
  return { ok: true, message: "Batch request sent to staff." };
}

export async function removeDraftBatchProductsAction(
  raw: unknown
): Promise<CustomerBatchQuoteState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = removeDraftBatchProductsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const result = await removeItemRequestsFromOwnerDraftBatchSession({
      clerkUserId: userId,
      batchSessionId: parsed.data.batchSessionId,
      itemRequestIds: parsed.data.itemRequestIds,
    });

    let message =
      result.removedCount === 1
        ? "Removed one product — it appears on Products again."
        : `${result.removedCount} products moved back to Products.`;

    if (result.batchDissolved) {
      message +=
        " The draft batch was closed because bundled quotes require at least two products.";
    }

    revalidateDashboardAddItem();
    return { ok: true, message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update batch.";
    return { ok: false, message: msg };
  }
}

export async function requestBatchEstimateRevisionAction(
  raw: unknown
): Promise<CustomerBatchQuoteState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = requestBatchEstimateRevisionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    await requestEstimatedBatchRevisionForOwner({
      clerkUserId: userId,
      sessionId: parsed.data.batchSessionId,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not request a new estimate.";
    return { ok: false, message: msg };
  }

  revalidateDashboardAddItem();
  revalidatePath("/dashboard/items");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/item-requests/batch-items/batch-history");
  revalidatePath("/admin/overview");

  return {
    ok: true,
    message:
      "Your batch was returned to staff. They will prepare a revised batch estimate.",
  };
}

export async function withdrawSubmittedBatchSessionAction(
  raw: unknown
): Promise<CustomerBatchQuoteState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = withdrawSubmittedBatchSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const { returnedCount } = await withdrawSubmittedBatchQuoteSessionForOwner({
      clerkUserId: userId,
      batchSessionId: parsed.data.batchSessionId,
    });

    revalidateDashboardAddItem();
    revalidatePath("/dashboard/items");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/admin/item-requests/batch-items/batch-history");
    revalidatePath("/admin/item-requests/batch-items/submitted");
    revalidatePath("/admin/overview");

    const message =
      returnedCount === 0
        ? "Batch request withdrawn. Staff will no longer prepare a batch estimate."
        : returnedCount === 1
          ? "Batch request withdrawn. Your product returned to Products for an individual quote."
          : `Batch request withdrawn. ${returnedCount} products returned to Products for individual quotes.`;

    return { ok: true, message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not withdraw batch request.";
    return { ok: false, message: msg };
  }
}

export type WithdrawQuotedBatchSessionState = {
  ok: boolean;
  message?: string;
  needsAcknowledgment?: boolean;
  emptyBatch?: boolean;
  missingQuotesForProducts?: string[];
};

export async function withdrawQuotedBatchSessionAction(
  raw: unknown
): Promise<WithdrawQuotedBatchSessionState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = withdrawQuotedBatchSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const result = await withdrawEstimatedBatchQuoteSessionForOwner({
      clerkUserId: userId,
      batchSessionId: parsed.data.batchSessionId,
      acknowledgeWithdrawalAnomalies: Boolean(
        parsed.data.acknowledgeWithdrawalAnomalies
      ),
    });

    if (result.outcome === "needs_ack") {
      return {
        ok: false,
        needsAcknowledgment: true,
        emptyBatch: result.emptyBatch,
        missingQuotesForProducts: result.missingQuotesForProducts,
        message: "Confirmation required before removing this bundle.",
      };
    }

    revalidateDashboardAddItem();
    revalidatePath("/dashboard/items");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/admin/item-requests/batch-items/batch-history");
    revalidatePath("/admin/item-requests/batch-items/batch-estimates");
    return {
      ok: true,
      message:
        "Batch removed from Batch Quotes. Your products stay on the Products tab.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not withdraw batch.";
    return { ok: false, message: msg };
  }
}
