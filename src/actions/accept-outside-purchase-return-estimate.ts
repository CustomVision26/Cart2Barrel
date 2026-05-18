"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests, outsidePurchaseReturnRequests } from "@/db/schema";
import { getItemRequestById } from "@/data/item-requests";
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { isMissingOutsidePurchaseReturnRequestsTableError } from "@/lib/db-column-missing";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { acceptOutsidePurchaseReturnEstimateSchema } from "@/lib/validations/outside-purchase-return-request";

export type AcceptOutsidePurchaseReturnEstimateState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function acceptOutsidePurchaseReturnEstimateAction(
  raw: unknown,
): Promise<AcceptOutsidePurchaseReturnEstimateState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to accept the return estimate." };
  }

  const parsed = acceptOutsidePurchaseReturnEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const req = await getItemRequestById(parsed.data.itemRequestId);
  if (!req || req.clerkUserId !== userId || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Product not found." };
  }

  const returnReq = await getOutsidePurchaseReturnRequestByItemRequestId(req.id);
  if (!returnReq || returnReq.status !== "estimate_ready") {
    return {
      ok: false,
      message: "No return estimate is ready to accept yet.",
    };
  }

  const now = new Date().toISOString();
  const db = getDb();
  try {
    await db
      .update(outsidePurchaseReturnRequests)
      .set({
        status: "estimate_accepted",
        estimateAcceptedAt: now,
        updatedAt: now,
      })
      .where(eq(outsidePurchaseReturnRequests.id, returnReq.id));

    await db
      .update(itemRequests)
      .set({ outsidePurchasePaymentPromptedAt: now })
      .where(eq(itemRequests.id, req.id));
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

  return {
    ok: true,
    message:
      "Return estimate accepted. Pay the service and handling charge (Add to cart) before drop-off at the carrier.",
  };
}
