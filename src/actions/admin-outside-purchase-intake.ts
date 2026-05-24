"use server";

import { put } from "@vercel/blob";
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
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { getOutsidePurchaseServiceTiersForEstimates } from "@/data/merchant-pricing-settings";
import {
  insertItemQuoteForRequest,
  itemRequestSnapshotForQuote,
  voidActiveQuotesForItemRequest,
} from "@/data/item-quotes";
import {
  appendOutsidePurchasePackMetaToStaffNote,
  computeOutsidePurchaseCustomerQuoteCents,
} from "@/lib/outside-purchase-service-quote";
import { formatUsd } from "@/lib/admin-markup";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  formatOutsidePurchaseReference,
  isOutsidePurchaseRequest,
  outsidePurchaseProductUrl,
} from "@/lib/outside-purchase";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { isMissingOutsidePurchaseReceiptImageUrlColumnError } from "@/lib/db-column-missing";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { withOutsidePurchaseStaffNotePrefix } from "@/lib/outside-purchase-staff-note";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import {
  adminUpdateOutsidePurchaseIntakeSchema,
  parseAdminOutsidePurchaseIntakeInput,
} from "@/lib/validations/admin-outside-purchase-intake";
import { recordOutsidePurchasePaymentPromptSchema } from "@/lib/validations/record-outside-purchase-payment-prompt";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type SaveAdminOutsidePurchaseIntakeState = {
  ok: boolean;
  message?: string;
  itemRequestId?: string;
  outsidePurchaseReference?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function intakeFieldsFromFormData(formData: FormData): Record<string, unknown> {
  const num = (key: string) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    clerkUserId: formData.get("clerkUserId"),
    outsidePurchaseReference: formData.get("outsidePurchaseReference") || undefined,
    productName: formData.get("productName"),
    quantity: num("quantity"),
    unitsPerPack: num("unitsPerPack"),
    productSize: formData.get("productSize") || undefined,
    productColor: formData.get("productColor") || undefined,
    note: formData.get("note") || undefined,
    unitPriceCents: num("unitPriceCents"),
    staffNote: formData.get("staffNote") || undefined,
    receivedCondition: formData.get("receivedCondition") || undefined,
    receivedShelfLocation: formData.get("receivedShelfLocation") || undefined,
  };
}

function imageFileFromFormData(formData: FormData, field: string): File | null {
  const raw = formData.get(field);
  return raw instanceof File && raw.size > 0 ? raw : null;
}

async function uploadIntakeImageForRequest(
  itemRequestId: string,
  file: File,
  folder: "product-images" | "outside-purchase-receipts",
): Promise<string | null> {
  const token = getBlobReadWriteToken();
  if (!token) return null;

  if (!isRetailerReceiptImageMime(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed.");
  }
  if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    throw new Error(
      `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const ext = retailerReceiptExtensionForMime(file.type);
  const pathname = `${folder}/${itemRequestId}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(pathname, file, {
    access: "public",
    token,
    contentType: file.type || undefined,
  });
  return blob.url;
}

export async function saveAdminOutsidePurchaseIntakeAction(
  raw: unknown,
): Promise<SaveAdminOutsidePurchaseIntakeState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const productImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "productImage") : null;
  const receiptImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "receiptImage") : null;
  const fields =
    raw instanceof FormData ? intakeFieldsFromFormData(raw) : raw;

  const parsed = parseAdminOutsidePurchaseIntakeInput(fields);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors, message: "Invalid intake payload." };
  }

  const d = parsed.data;
  const reference = d.outsidePurchaseReference ?? formatOutsidePurchaseReference();
  const productUrl = outsidePurchaseProductUrl(reference);
  const siteName = "Outside purchase";

  const serviceTiers = await getOutsidePurchaseServiceTiersForEstimates();
  const pricing = computeOutsidePurchaseCustomerQuoteCents({
    unitPriceCents: d.unitPriceCents,
    quantity: d.quantity,
    unitsPerPack: d.unitsPerPack,
    serviceTiers,
  });

  if ((productImageFile || receiptImageFile) && !getBlobReadWriteToken()) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const promptedAt = new Date().toISOString();
  const db = getDb();
  let created;
  try {
    [created] = await db
      .insert(itemRequests)
      .values({
        clerkUserId: d.clerkUserId,
        productUrl,
        productName: d.productName,
        productSize: d.productSize ?? null,
        productColor: d.productColor ?? null,
        quantity: d.quantity,
        note: d.note ?? null,
        siteName,
        status: "quoted",
        source: "outside_purchase",
        outsidePurchaseReference: reference,
        outsidePurchaseReceivedCondition: d.receivedCondition,
        outsidePurchaseShelfLocation:
          d.receivedShelfLocation === "" ? null : d.receivedShelfLocation,
        outsidePurchasePaymentPromptedAt: promptedAt,
      })
      .returning();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save product.";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return {
        ok: false,
        message: "That outside-purchase reference is already in use. Generate a new one or pick another.",
        fieldErrors: { outsidePurchaseReference: ["Reference must be unique."] },
      };
    }
    return { ok: false, message: msg };
  }

  if (!created) {
    return { ok: false, message: "Could not save product." };
  }

  try {
    if (productImageFile) {
      const imageUrl = await uploadIntakeImageForRequest(
        created.id,
        productImageFile,
        "product-images",
      );
      if (imageUrl) {
        await db
          .update(itemRequests)
          .set({ productImageUrl: imageUrl })
          .where(eq(itemRequests.id, created.id));
        created = { ...created, productImageUrl: imageUrl };
      }
    }

    if (receiptImageFile) {
      const receiptUrl = await uploadIntakeImageForRequest(
        created.id,
        receiptImageFile,
        "outside-purchase-receipts",
      );
      if (receiptUrl) {
        try {
          await db
            .update(itemRequests)
            .set({ outsidePurchaseReceiptImageUrl: receiptUrl })
            .where(eq(itemRequests.id, created.id));
          created = { ...created, outsidePurchaseReceiptImageUrl: receiptUrl };
        } catch (e) {
          if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
            return {
              ok: false,
              message:
                "Receipt uploaded but could not be saved — run npm run db:push to apply migration 0044_outside_purchase_receipt_image.",
              itemRequestId: created.id,
            };
          }
          throw e;
        }
      }
    }

    const snap = itemRequestSnapshotForQuote(created);
    const serviceLine =
      pricing.isPackLine ?
        `Outside purchase service & handling: ${formatUsd(pricing.perUnitServiceCents)}/unit × ${pricing.unitsPerPack} units/pack × ${pricing.quantity} pack${pricing.quantity === 1 ? "" : "s"} (${pricing.consumerUnits} units) = ${formatUsd(pricing.serviceFeeCents)} (customer pays).`
      : `Outside purchase service & handling: ${formatUsd(pricing.perUnitServiceCents)}/unit × ${pricing.quantity} = ${formatUsd(pricing.serviceFeeCents)} (customer pays).`;
    const shelfTrim = d.receivedShelfLocation.trim();
    const staffNoteParts = [
      withOutsidePurchaseStaffNotePrefix(d.staffNote),
      d.note ? `Receipt note: ${d.note}` : null,
      `Received condition: ${warehouseReceiveConditionLabel(d.receivedCondition)}.`,
      `Shelf / bin: ${shelfTrim || "—"}.`,
      serviceLine,
      `Listed unit price for tier: ${formatUsd(pricing.unitPriceCents)}.`,
    ].filter(Boolean);
    const staffNote = appendOutsidePurchasePackMetaToStaffNote(
      staffNoteParts.join("\n\n"),
      pricing.unitsPerPack,
    );

    const quote = await insertItemQuoteForRequest(created.id, {
      itemCost: 0,
      serviceFee: pricing.serviceFeeCents,
      packingFeeCents: 0,
      estimatedShipping: 0,
      totalPrice: pricing.totalPriceCents,
      staffNote,
      ...snap,
    });

    await insertItemRequestLineSnapshot({
      itemRequestId: created.id,
      phase: "outside_purchase_intake",
      itemQuoteId: quote.id,
      line: lineSnapshotPayloadFromItemRequest(created),
      auditMemo: `Outside purchase intake · ${reference} · ${warehouseReceiveConditionLabel(d.receivedCondition)} · ${formatUsd(pricing.totalPriceCents)} service & handling`,
    });

    await insertItemRequestLineSnapshot({
      itemRequestId: created.id,
      phase: "outside_purchase_payment_prompted",
      itemQuoteId: quote.id,
      line: lineSnapshotPayloadFromItemRequest(created),
      auditMemo: "Customer prompted to pay service & handling (intake).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save estimate.";
    return { ok: false, message: msg, itemRequestId: created.id };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: `Saved ${reference}. Customer owes ${formatUsd(pricing.totalPriceCents)} (service & handling only).`,
    itemRequestId: created.id,
    outsidePurchaseReference: reference,
  };
}

export type UpdateAdminOutsidePurchaseIntakeState = SaveAdminOutsidePurchaseIntakeState;

export async function updateAdminOutsidePurchaseIntakeAction(
  raw: unknown,
): Promise<UpdateAdminOutsidePurchaseIntakeState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const productImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "productImage") : null;
  const receiptImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "receiptImage") : null;
  const fields =
    raw instanceof FormData ?
      { ...intakeFieldsFromFormData(raw), itemRequestId: raw.get("itemRequestId") }
    : raw;

  const parsed = adminUpdateOutsidePurchaseIntakeSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, message: "Invalid update payload." };
  }

  const d = parsed.data;
  const existing = await getItemRequestById(d.itemRequestId);
  if (!existing || !isOutsidePurchaseRequest(existing)) {
    return { ok: false, message: "Outside-purchase product not found." };
  }
  if (existing.status !== "quoted") {
    return {
      ok: false,
      message: "Only quoted outside-purchase lines can be edited here.",
    };
  }

  const reference =
    d.outsidePurchaseReference ?? existing.outsidePurchaseReference ?? formatOutsidePurchaseReference();
  const productUrl = outsidePurchaseProductUrl(reference);
  const serviceTiers = await getOutsidePurchaseServiceTiersForEstimates();
  const pricing = computeOutsidePurchaseCustomerQuoteCents({
    unitPriceCents: d.unitPriceCents,
    quantity: d.quantity,
    unitsPerPack: d.unitsPerPack,
    serviceTiers,
  });

  if ((productImageFile || receiptImageFile) && !getBlobReadWriteToken()) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const db = getDb();
  const [updated] = await db
    .update(itemRequests)
    .set({
      clerkUserId: d.clerkUserId,
      productUrl,
      productName: d.productName,
      productSize: d.productSize ?? null,
      productColor: d.productColor ?? null,
      quantity: d.quantity,
      note: d.note ?? null,
      outsidePurchaseReference: reference,
      outsidePurchaseReceivedCondition: d.receivedCondition,
      outsidePurchaseShelfLocation:
        d.receivedShelfLocation === "" ? null : d.receivedShelfLocation,
    })
    .where(eq(itemRequests.id, existing.id))
    .returning();

  if (!updated) {
    return { ok: false, message: "Could not update product." };
  }

  let row = updated;
  try {
    if (productImageFile) {
      const imageUrl = await uploadIntakeImageForRequest(
        row.id,
        productImageFile,
        "product-images",
      );
      if (imageUrl) {
        await db
          .update(itemRequests)
          .set({ productImageUrl: imageUrl })
          .where(eq(itemRequests.id, row.id));
        row = { ...row, productImageUrl: imageUrl };
      }
    }
    if (receiptImageFile) {
      const receiptUrl = await uploadIntakeImageForRequest(
        row.id,
        receiptImageFile,
        "outside-purchase-receipts",
      );
      if (receiptUrl) {
        await db
          .update(itemRequests)
          .set({ outsidePurchaseReceiptImageUrl: receiptUrl })
          .where(eq(itemRequests.id, row.id));
        row = { ...row, outsidePurchaseReceiptImageUrl: receiptUrl };
      }
    }

    await voidActiveQuotesForItemRequest(row.id, "staff_replacement");
    const snap = itemRequestSnapshotForQuote(row);
    const serviceLine =
      pricing.isPackLine ?
        `Outside purchase service & handling: ${formatUsd(pricing.perUnitServiceCents)}/unit × ${pricing.unitsPerPack} units/pack × ${pricing.quantity} pack${pricing.quantity === 1 ? "" : "s"} (${pricing.consumerUnits} units) = ${formatUsd(pricing.serviceFeeCents)} (customer pays).`
      : `Outside purchase service & handling: ${formatUsd(pricing.perUnitServiceCents)}/unit × ${pricing.quantity} = ${formatUsd(pricing.serviceFeeCents)} (customer pays).`;
    const shelfTrim = d.receivedShelfLocation.trim();
    const staffNote = appendOutsidePurchasePackMetaToStaffNote(
      [
        withOutsidePurchaseStaffNotePrefix(d.staffNote),
        d.note ? `Receipt note: ${d.note}` : null,
        `Received condition: ${warehouseReceiveConditionLabel(d.receivedCondition)}.`,
        `Shelf / bin: ${shelfTrim || "—"}.`,
        serviceLine,
        `Listed unit price for tier: ${formatUsd(pricing.unitPriceCents)}.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      pricing.unitsPerPack,
    );

    const returnReq = await getOutsidePurchaseReturnRequestByItemRequestId(row.id);
    const returnFee = returnReq?.returnServiceFeeCents;
    const quote = await insertItemQuoteForRequest(row.id, {
      itemCost: 0,
      serviceFee: returnFee ?? pricing.serviceFeeCents,
      packingFeeCents: 0,
      estimatedShipping: 0,
      totalPrice: returnFee ?? pricing.totalPriceCents,
      staffNote,
      ...snap,
    });

    await insertItemRequestLineSnapshot({
      itemRequestId: row.id,
      phase: "outside_purchase_intake",
      itemQuoteId: quote.id,
      line: lineSnapshotPayloadFromItemRequest(row),
      auditMemo: `Outside purchase updated · ${reference} · ${warehouseReceiveConditionLabel(d.receivedCondition)}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update estimate.";
    return { ok: false, message: msg, itemRequestId: row.id };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: `Updated ${reference}.`,
    itemRequestId: row.id,
    outsidePurchaseReference: reference,
  };
}

export type RecordOutsidePurchasePaymentPromptState = {
  ok: boolean;
  message?: string;
};

export async function recordOutsidePurchasePaymentPromptAction(
  raw: unknown,
): Promise<RecordOutsidePurchasePaymentPromptState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = recordOutsidePurchasePaymentPromptSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const { itemRequestId } = parsed.data;

  const req = await getItemRequestById(itemRequestId);
  if (!req || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Outside-purchase product not found." };
  }
  if (req.status !== "quoted") {
    return {
      ok: false,
      message:
        req.status === "approved"
          ? "Customer already added this to cart."
          : "Only unpaid outside-purchase lines can be prompted.",
    };
  }

  const promptedAt = new Date().toISOString();
  const db = getDb();
  await db
    .update(itemRequests)
    .set({ outsidePurchasePaymentPromptedAt: promptedAt })
    .where(eq(itemRequests.id, req.id));

  await insertItemRequestLineSnapshot({
    itemRequestId: req.id,
    phase: "outside_purchase_payment_prompted",
    line: lineSnapshotPayloadFromItemRequest(req),
    auditMemo: "Staff recorded: customer prompted to add to cart and pay.",
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: "Recorded — customer should add this line to cart from Products → Active.",
  };
}
