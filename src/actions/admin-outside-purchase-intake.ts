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
import { getOrderContextByItemRequestIds } from "@/data/item-request-order-context";
import { insertOutsidePurchaseLifecycleSnapshot } from "@/data/outside-purchase-lifecycle-snapshot";
import { getOutsidePurchaseReturnRequestByItemRequestId } from "@/data/outside-purchase-return-requests";
import { getOutsidePurchaseServiceTiersForEstimates } from "@/data/merchant-pricing-settings";
import {
  insertItemQuoteForRequest,
  getLatestQuoteForItemRequest,
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
import { ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT } from "@/lib/item-quote-void-reason";
import { adminOutsidePurchaseDeleteEligibility } from "@/lib/outside-purchase-published";
import {
  isMissingOutsidePurchaseConditionImageUrlColumnError,
  isMissingOutsidePurchaseConditionImageUrlsColumnError,
  isMissingOutsidePurchaseReceiptImageUrlColumnError,
} from "@/lib/db-column-missing";
import {
  OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX,
  parseOutsidePurchaseConditionPhotoPlan,
  productDisplayImageIndexFromFormData,
  type OutsidePurchaseConditionPhotoPlanEntry,
} from "@/lib/outside-purchase-condition-images";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { withOutsidePurchaseStaffNotePrefix } from "@/lib/outside-purchase-staff-note";
import {
  warehouseMissingReasonLabel,
  warehouseReceiveConditionLabel,
} from "@/lib/warehouse-receive-condition";
import {
  adminUpdateOutsidePurchaseIntakeSchema,
  parseAdminOutsidePurchaseIntakeInput,
} from "@/lib/validations/admin-outside-purchase-intake";
import { recordOutsidePurchasePaymentPromptSchema } from "@/lib/validations/record-outside-purchase-payment-prompt";
import { recordOutsidePurchasePaymentPromptActivity } from "@/data/user-status-update-events";
import { outsidePurchasePublishActionSchema } from "@/lib/validations/outside-purchase-publish";
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
    receivedMissingReason: formData.get("receivedMissingReason") || undefined,
    receivedShelfLocation: formData.get("receivedShelfLocation") || undefined,
  };
}

function imageFileFromFormData(formData: FormData, field: string): File | null {
  const raw = formData.get(field);
  return raw instanceof File && raw.size > 0 ? raw : null;
}

function imageFilesFromFormData(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((raw): raw is File => raw instanceof File && raw.size > 0);
}

function conditionPhotoPlanFromFormData(
  formData: FormData,
  isCreate: boolean,
  newFiles: File[],
): OutsidePurchaseConditionPhotoPlanEntry[] {
  if (isCreate) {
    return newFiles.map(() => ({ type: "new" }));
  }
  const parsed = parseOutsidePurchaseConditionPhotoPlan(
    formData.get("conditionPhotoPlan"),
  );
  if (parsed) return parsed;
  const legacyFile = imageFileFromFormData(formData, "conditionImage");
  if (legacyFile) {
    return [{ type: "new" }];
  }
  return [];
}

async function buildOutsidePurchaseConditionImageUrls(
  itemRequestId: string,
  formData: FormData,
  options: { isCreate: boolean },
): Promise<string[]> {
  let newFiles = imageFilesFromFormData(formData, "conditionImages");
  const legacyFile = imageFileFromFormData(formData, "conditionImage");
  if (newFiles.length === 0 && legacyFile) {
    newFiles = [legacyFile];
  }

  const plan = conditionPhotoPlanFromFormData(formData, options.isCreate, newFiles);
  if (plan.length === 0) return [];

  if (plan.length > OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX) {
    throw new Error(
      `At most ${OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX} received condition photos.`,
    );
  }

  let fileIndex = 0;
  const urls: string[] = [];
  for (const entry of plan) {
    if (entry.type === "existing") {
      urls.push(entry.url);
      continue;
    }
    const file = newFiles[fileIndex++];
    if (!file) continue;
    const url = await uploadIntakeImageForRequest(
      itemRequestId,
      file,
      "outside-purchase-condition",
    );
    if (url) urls.push(url);
  }
  return urls;
}

async function persistOutsidePurchaseConditionPhotos(
  db: ReturnType<typeof getDb>,
  itemRequestId: string,
  formData: FormData,
  options: { isCreate: boolean },
): Promise<
  | {
      outsidePurchaseConditionImageUrls: string[];
      outsidePurchaseConditionImageUrl: string | null;
      productImageUrl: string | null;
    }
  | { error: string }
> {
  const urls = await buildOutsidePurchaseConditionImageUrls(
    itemRequestId,
    formData,
    options,
  );
  if (urls.length === 0) {
    return {
      outsidePurchaseConditionImageUrls: [],
      outsidePurchaseConditionImageUrl: null,
      productImageUrl: null,
    };
  }

  const displayIndex = productDisplayImageIndexFromFormData(formData, 0);
  const safeIndex = Math.min(
    Math.max(0, displayIndex),
    urls.length - 1,
  );
  const payload = {
    outsidePurchaseConditionImageUrls: urls,
    outsidePurchaseConditionImageUrl: urls[0] ?? null,
    productImageUrl: urls[safeIndex] ?? urls[0] ?? null,
  };

  try {
    await db
      .update(itemRequests)
      .set(payload)
      .where(eq(itemRequests.id, itemRequestId));
    return payload;
  } catch (e) {
    if (isMissingOutsidePurchaseConditionImageUrlsColumnError(e)) {
      try {
        await db
          .update(itemRequests)
          .set({
            outsidePurchaseConditionImageUrl: payload.outsidePurchaseConditionImageUrl,
            productImageUrl: payload.productImageUrl,
          })
          .where(eq(itemRequests.id, itemRequestId));
        return payload;
      } catch (inner) {
        if (isMissingOutsidePurchaseConditionImageUrlColumnError(inner)) {
          return {
            error:
              "Condition photos uploaded but could not be saved — run npm run db:push to apply migration 0072_outside_purchase_condition_image_urls.",
          };
        }
        throw inner;
      }
    }
    if (isMissingOutsidePurchaseConditionImageUrlColumnError(e)) {
      return {
        error:
          "Condition photos uploaded but could not be saved — run npm run db:push to apply migration 0066_outside_purchase_condition_image.",
      };
    }
    throw e;
  }
}

async function uploadIntakeImageForRequest(
  itemRequestId: string,
  file: File,
  folder:
    | "product-images"
    | "outside-purchase-receipts"
    | "outside-purchase-condition",
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

  const receiptImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "receiptImage") : null;
  const conditionImageFiles =
    raw instanceof FormData ? imageFilesFromFormData(raw, "conditionImages") : [];
  const legacyConditionImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "conditionImage") : null;
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
  const missingReason =
    d.receivedCondition === "missing" ? (d.receivedMissingReason ?? null) : null;
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

  if (
    (receiptImageFile ||
      conditionImageFiles.length > 0 ||
      legacyConditionImageFile) &&
    !getBlobReadWriteToken()
  ) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

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
        outsidePurchaseMissingReason: missingReason,
        outsidePurchaseShelfLocation:
          d.receivedShelfLocation === "" ? null : d.receivedShelfLocation,
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

    if (
      conditionImageFiles.length > 0 ||
      legacyConditionImageFile ||
      (raw instanceof FormData &&
        parseOutsidePurchaseConditionPhotoPlan(raw.get("conditionPhotoPlan"))?.length)
    ) {
      const conditionResult = await persistOutsidePurchaseConditionPhotos(
        db,
        created.id,
        raw instanceof FormData ? raw : new FormData(),
        { isCreate: true },
      );
      if ("error" in conditionResult) {
        return {
          ok: false,
          message: conditionResult.error,
          itemRequestId: created.id,
        };
      }
      created = {
        ...created,
        outsidePurchaseConditionImageUrls:
          conditionResult.outsidePurchaseConditionImageUrls,
        outsidePurchaseConditionImageUrl:
          conditionResult.outsidePurchaseConditionImageUrl,
        productImageUrl: conditionResult.productImageUrl,
      };
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
      `Received condition: ${warehouseReceiveConditionLabel(d.receivedCondition)}${
        missingReason ? ` (${warehouseMissingReasonLabel(missingReason)})` : ""
      }.`,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save estimate.";
    return { ok: false, message: msg, itemRequestId: created.id };
  }

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: `Saved ${reference} as draft. Publish when the customer should see it in Active products (${formatUsd(pricing.totalPriceCents)} service & handling).`,
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

  const receiptImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "receiptImage") : null;
  const conditionImageFiles =
    raw instanceof FormData ? imageFilesFromFormData(raw, "conditionImages") : [];
  const legacyConditionImageFile =
    raw instanceof FormData ? imageFileFromFormData(raw, "conditionImage") : null;
  const conditionPhotoPlan =
    raw instanceof FormData ?
      parseOutsidePurchaseConditionPhotoPlan(raw.get("conditionPhotoPlan"))
    : null;
  const fields =
    raw instanceof FormData ?
      { ...intakeFieldsFromFormData(raw), itemRequestId: raw.get("itemRequestId") }
    : raw;

  const parsed = adminUpdateOutsidePurchaseIntakeSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, message: "Invalid update payload." };
  }

  const d = parsed.data;
  const missingReason =
    d.receivedCondition === "missing" ? (d.receivedMissingReason ?? null) : null;
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
  if (existing.outsidePurchasePublishedAt) {
    return {
      ok: false,
      message: "Withdraw this line from the customer before editing.",
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

  if (
    (receiptImageFile ||
      conditionImageFiles.length > 0 ||
      legacyConditionImageFile ||
      (conditionPhotoPlan && conditionPhotoPlan.length > 0)) &&
    !getBlobReadWriteToken()
  ) {
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
      outsidePurchaseMissingReason: missingReason,
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
    if (
      conditionImageFiles.length > 0 ||
      legacyConditionImageFile ||
      (raw instanceof FormData && raw.has("conditionPhotoPlan"))
    ) {
      const conditionResult = await persistOutsidePurchaseConditionPhotos(
        db,
        row.id,
        raw instanceof FormData ? raw : new FormData(),
        { isCreate: false },
      );
      if ("error" in conditionResult) {
        return {
          ok: false,
          message: conditionResult.error,
          itemRequestId: row.id,
        };
      }
      row = {
        ...row,
        outsidePurchaseConditionImageUrls:
          conditionResult.outsidePurchaseConditionImageUrls,
        outsidePurchaseConditionImageUrl:
          conditionResult.outsidePurchaseConditionImageUrl,
        productImageUrl: conditionResult.productImageUrl,
      };
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
        `Received condition: ${warehouseReceiveConditionLabel(d.receivedCondition)}${
          missingReason ? ` (${warehouseMissingReasonLabel(missingReason)})` : ""
        }.`,
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
  if (!req.outsidePurchasePublishedAt) {
    return {
      ok: false,
      message: "Publish this line to the customer before recording a payment prompt.",
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

  const quote = await getLatestQuoteForItemRequest(req.id);
  await recordOutsidePurchasePaymentPromptActivity({
    clerkUserId: req.clerkUserId,
    itemRequestId: req.id,
    productName: req.productName,
    totalPriceCents: quote?.totalPrice ?? null,
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message:
      "Prompt to pay sent — the customer was notified to add this line to cart from Products → Active.",
  };
}

export type OutsidePurchasePublishState = {
  ok: boolean;
  message?: string;
};

export async function publishOutsidePurchaseAction(
  raw: unknown,
): Promise<OutsidePurchasePublishState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = outsidePurchasePublishActionSchema.safeParse(raw);
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
      message: "Only quoted outside-purchase lines can be published.",
    };
  }
  if (req.outsidePurchasePublishedAt) {
    return { ok: false, message: "Already published to the customer." };
  }

  const publishedAt = new Date().toISOString();
  const db = getDb();
  await db
    .update(itemRequests)
    .set({ outsidePurchasePublishedAt: publishedAt })
    .where(eq(itemRequests.id, req.id));

  await insertItemRequestLineSnapshot({
    itemRequestId: req.id,
    phase: "outside_purchase_published",
    line: lineSnapshotPayloadFromItemRequest(req),
    auditMemo: "Staff published this outside purchase to the customer's Active products.",
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: "Published — customer can see this line under Products → Active.",
  };
}

export async function withdrawOutsidePurchaseFromCustomerAction(
  raw: unknown,
): Promise<OutsidePurchasePublishState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = outsidePurchasePublishActionSchema.safeParse(raw);
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
          ? "Customer already added this to cart — cannot withdraw."
          : "Only unpublished pool lines can be withdrawn from the customer.",
    };
  }
  if (!req.outsidePurchasePublishedAt) {
    return { ok: false, message: "This line is not published to the customer." };
  }

  const db = getDb();
  await db
    .update(itemRequests)
    .set({
      outsidePurchasePublishedAt: null,
      outsidePurchasePaymentPromptedAt: null,
    })
    .where(eq(itemRequests.id, req.id));

  await insertItemRequestLineSnapshot({
    itemRequestId: req.id,
    phase: "outside_purchase_unpublished",
    line: lineSnapshotPayloadFromItemRequest(req),
    auditMemo:
      "Staff withdrew this outside purchase from the customer's Active products.",
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: "Withdrawn — customer no longer sees this line until you publish again.",
  };
}

export type DeleteAdminOutsidePurchaseIntakeState = OutsidePurchasePublishState;

export async function deleteAdminOutsidePurchaseIntakeAction(
  raw: unknown,
): Promise<DeleteAdminOutsidePurchaseIntakeState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = outsidePurchasePublishActionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const { itemRequestId } = parsed.data;

  const req = await getItemRequestById(itemRequestId);
  if (!req || !isOutsidePurchaseRequest(req)) {
    return { ok: false, message: "Outside-purchase product not found." };
  }

  const orderContextMap = await getOrderContextByItemRequestIds([itemRequestId]);
  const eligibility = adminOutsidePurchaseDeleteEligibility(
    req,
    orderContextMap.get(itemRequestId) ?? null,
  );
  if (!eligibility.allowed) {
    return { ok: false, message: eligibility.reason };
  }

  const wasPublished = Boolean(req.outsidePurchasePublishedAt);
  const reference =
    req.outsidePurchaseReference?.trim() || formatOutsidePurchaseReference();

  if (req.status === "quoted") {
    await voidActiveQuotesForItemRequest(
      itemRequestId,
      ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT,
    );
  }

  const db = getDb();
  const [updated] = await db
    .update(itemRequests)
    .set({
      status: "withdrawn",
      outsidePurchasePublishedAt: null,
      outsidePurchasePaymentPromptedAt: null,
    })
    .where(eq(itemRequests.id, itemRequestId))
    .returning();

  if (!updated) {
    return { ok: false, message: "Could not delete this outside purchase." };
  }

  await insertOutsidePurchaseLifecycleSnapshot({
    request: updated,
    phase: "outside_purchase_withdrawn_from_active",
    auditMemo: wasPublished
      ? `Staff deleted outside purchase ${reference} — removed from the customer's Active products and admin intake pool.`
      : `Staff deleted outside purchase intake ${reference} from the admin pool.`,
  });

  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/overview");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message: wasPublished
      ? "Deleted — customer no longer sees this line in Active products."
      : "Deleted outside purchase intake record.",
  };
}
