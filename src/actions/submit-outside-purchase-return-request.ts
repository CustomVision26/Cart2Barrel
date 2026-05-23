"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests, outsidePurchaseReturnRequests } from "@/db/schema";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { recordOutsidePurchaseReturnSubmittedActivity } from "@/data/admin-user-activity-events";
import { getItemRequestById } from "@/data/item-requests";
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { outsidePurchaseShowsReturnToRetailerAction } from "@/lib/outside-purchase-display";
import { isMissingOutsidePurchaseReturnRequestsTableError } from "@/lib/db-column-missing";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { submitOutsidePurchaseReturnRequestSchema } from "@/lib/validations/outside-purchase-return-request";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type SubmitOutsidePurchaseReturnRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function fieldsFromFormData(formData: FormData): Record<string, unknown> {
  return {
    itemRequestId: formData.get("itemRequestId"),
    returnWindowStart: formData.get("returnWindowStart"),
    returnWindowEnd: formData.get("returnWindowEnd"),
    customerNotes: formData.get("customerNotes") || undefined,
    acknowledgeDiscardPolicy:
      formData.get("acknowledgeDiscardPolicy") === "true" ||
      formData.get("acknowledgeDiscardPolicy") === "on",
  };
}

export async function submitOutsidePurchaseReturnRequestAction(
  raw: unknown,
): Promise<SubmitOutsidePurchaseReturnRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to request a return." };
  }

  const labelFile =
    raw instanceof FormData ?
      (() => {
        const f = raw.get("returnLabelImage");
        return f instanceof File && f.size > 0 ? f : null;
      })()
    : null;

  const parsed = submitOutsidePurchaseReturnRequestSchema.safeParse(
    raw instanceof FormData ? fieldsFromFormData(raw) : raw,
  );
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Invalid return request." };
  }

  const data = parsed.data;
  const req = await getItemRequestById(data.itemRequestId);
  if (!req || req.clerkUserId !== userId || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Product not found." };
  }

  const existing = await getOutsidePurchaseReturnRequestByItemRequestId(req.id);
  if (
    !outsidePurchaseShowsReturnToRetailerAction(req, existing ?? null)
  ) {
    return {
      ok: false,
      message: "This line is not eligible for a return-to-retailer request.",
    };
  }

  if (labelFile && !getBlobReadWriteToken()) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  let returnLabelImageUrl: string | null = null;
  if (labelFile) {
    if (!isRetailerReceiptImageMime(labelFile.type)) {
      return { ok: false, message: "Return label must be JPEG, PNG, WebP, or GIF." };
    }
    if (labelFile.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
      };
    }
    const token = getBlobReadWriteToken()!;
    const ext = retailerReceiptExtensionForMime(labelFile.type);
    const pathname = `outside-purchase-return-labels/${req.id}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, labelFile, {
      access: "public",
      token,
      contentType: labelFile.type || undefined,
    });
    returnLabelImageUrl = blob.url;
  }

  const db = getDb();
  const now = new Date().toISOString();

  try {
    if (existing) {
      await db
        .update(outsidePurchaseReturnRequests)
        .set({
          status: "submitted",
          returnLabelImageUrl,
          returnWindowStart: data.returnWindowStart,
          returnWindowEnd: data.returnWindowEnd,
          customerNotes: data.customerNotes ?? null,
          updatedAt: now,
        })
        .where(eq(outsidePurchaseReturnRequests.id, existing.id));
    } else {
      await db.insert(outsidePurchaseReturnRequests).values({
        itemRequestId: req.id,
        clerkUserId: userId,
        status: "submitted",
        returnLabelImageUrl,
        returnWindowStart: data.returnWindowStart,
        returnWindowEnd: data.returnWindowEnd,
        customerNotes: data.customerNotes ?? null,
      });
    }

    await insertItemRequestLineSnapshot({
      itemRequestId: req.id,
      phase: "outside_purchase_return_requested",
      line: lineSnapshotPayloadFromItemRequest(req),
      auditMemo: "Customer submitted return-to-retailer request.",
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

  await recordOutsidePurchaseReturnSubmittedActivity({
    customerClerkUserId: userId,
    itemRequestId: req.id,
    productName: req.productName,
  });

  revalidateDashboardAddItem();
  revalidatePath("/admin/item-requests", "layout");

  return {
    ok: true,
    message: "Return request submitted. Staff will send an estimate before you can drop off at the carrier.",
  };
}
