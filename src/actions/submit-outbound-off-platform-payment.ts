"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getOutboundShippingChargeForUser } from "@/data/barrel-outbound-shipping-charges";
import { recordOutboundOffPlatformPayment } from "@/data/barrel-outbound-shipping-charges";
import {
  isBarrelOutboundShippingChargeKind,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentMethod,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import { submitOutboundOffPlatformPaymentSchema } from "@/lib/validations/barrel-outbound-shipping-charge";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type SubmitOutboundOffPlatformPaymentState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function fieldsFromFormData(formData: FormData): Record<string, unknown> {
  return {
    chargeId: formData.get("chargeId"),
    paymentMethod: formData.get("paymentMethod"),
    payerAccountName: formData.get("payerAccountName") || "",
  };
}

function receiptFileFromFormData(formData: FormData): File | null {
  const file = formData.get("receipt");
  return file instanceof File && file.size > 0 ? file : null;
}

function isPaymentReceiptMime(mime: string): boolean {
  return isRetailerReceiptImageMime(mime) || mime === "application/pdf";
}

function receiptExtensionForMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  return retailerReceiptExtensionForMime(mime);
}

export async function submitOutboundOffPlatformPaymentAction(
  raw: unknown,
): Promise<SubmitOutboundOffPlatformPaymentState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const receiptFile =
    raw instanceof FormData ? receiptFileFromFormData(raw) : null;
  const parsed = submitOutboundOffPlatformPaymentSchema.safeParse(
    raw instanceof FormData ? fieldsFromFormData(raw) : raw,
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid payment details.",
    };
  }

  const { chargeId, paymentMethod, payerAccountName } = parsed.data;
  if (!isOffPlatformPaymentMethod(paymentMethod)) {
    return { ok: false, message: "Choose a payment option." };
  }

  const row = await getOutboundShippingChargeForUser(userId, chargeId);
  if (!row) {
    return { ok: false, message: "Shipping charge not found." };
  }
  const { charge } = row;
  if (
    !isBarrelOutboundShippingChargeKind(charge.chargeKind) ||
    !isOffPlatformOutboundChargeKind(charge.chargeKind)
  ) {
    return {
      ok: false,
      message: "This charge is paid through the cart.",
    };
  }
  if (charge.paidAt) {
    return { ok: false, message: "This charge is already marked paid." };
  }
  const replacingLocalOffice =
    Boolean(charge.offPlatformSubmittedAt) &&
    charge.offPlatformPaymentMethod === "local_office" &&
    (paymentMethod === "zelle" || paymentMethod === "cashapp");
  if (charge.offPlatformSubmittedAt && !replacingLocalOffice) {
    return { ok: false, message: "This charge already has a payment on file." };
  }

  const needsTransferProof =
    paymentMethod === "zelle" || paymentMethod === "cashapp";
  if (needsTransferProof) {
    const accountName = payerAccountName.trim();
    if (!accountName) {
      return { ok: false, message: "Enter the account name used to send payment." };
    }
    if (!receiptFile) {
      return { ok: false, message: "Upload a copy of the payment receipt." };
    }
    if (paymentMethod === "zelle" && !charge.partnerZelleId?.trim()) {
      return {
        ok: false,
        message: "Staff has not published a Zelle ID for this vendor yet.",
      };
    }
    if (paymentMethod === "cashapp" && !charge.partnerCashappId?.trim()) {
      return {
        ok: false,
        message: "Staff has not published a Cash App ID for this vendor yet.",
      };
    }
  }

  let receiptUrl: string | null = null;
  if (receiptFile) {
    if (!isPaymentReceiptMime(receiptFile.type)) {
      return {
        ok: false,
        message: "Receipt must be an image or PDF.",
      };
    }
    if (receiptFile.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: `Receipt must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
      };
    }
    const token = getBlobReadWriteToken();
    if (!token) {
      return { ok: false, message: blobReadWriteNotConfiguredMessage() };
    }
    const ext = receiptExtensionForMime(receiptFile.type);
    const pathname = `outbound-off-platform-receipts/${userId}/${chargeId}/${crypto.randomUUID()}.${ext}`;
    try {
      const blob = await put(pathname, receiptFile, {
        access: "public",
        token,
        contentType: receiptFile.type || undefined,
      });
      receiptUrl = blob.url;
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Could not upload the receipt.",
      };
    }
  }

  const result = await recordOutboundOffPlatformPayment({
    clerkUserId: userId,
    chargeId,
    paymentMethod,
    payerAccountName: payerAccountName.trim() || null,
    receiptUrl,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/cart");

  if (paymentMethod === "local_office") {
    return {
      ok: true,
      message:
        "Local office payment selected. Staff will confirm after you pay at the office.",
    };
  }
  return {
    ok: true,
    message:
      "Payment receipt submitted. Staff will verify it with the vendor before marking the charge paid.",
  };
}
