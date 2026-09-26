import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
} from "@/db/schema";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isBarrelOutboundShippingChargeKind,
  isOffPlatformPaymentMethod,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
  sumChargeLineCents,
  type OutboundShippingChargeLineView,
} from "@/lib/barrel-outbound-shipping-charge";
import type { OutboundOffPlatformReceiptPdfPayload } from "@/lib/invoice/outbound-payment-receipt-pdf-types";

function submittedLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function filenameSlug(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "receipt";
}

export async function getOutboundOffPlatformReceiptPdfPayload(input: {
  chargeId: string;
  clerkUserId?: string;
}): Promise<OutboundOffPlatformReceiptPdfPayload | null> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [charge] = await db
    .select()
    .from(barrelOutboundShippingCharges)
    .where(
      input.clerkUserId
        ? and(
            eq(barrelOutboundShippingCharges.id, input.chargeId),
            eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
          )
        : eq(barrelOutboundShippingCharges.id, input.chargeId),
    )
    .limit(1);
  if (!charge) return null;
  if (!charge.offPlatformSubmittedAt && !charge.paidAt) return null;

  const lineRows = await db
    .select()
    .from(barrelOutboundShippingChargeLines)
    .where(eq(barrelOutboundShippingChargeLines.chargeId, charge.id))
    .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex));
  const lines: OutboundShippingChargeLineView[] = lineRows.map((line) => ({
    label: line.label,
    amountCents: line.amountCents,
  }));
  const totalCents = sumChargeLineCents(lines);
  const kind = isBarrelOutboundShippingChargeKind(charge.chargeKind)
    ? charge.chargeKind
    : "freight";
  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind];
  const method = isOffPlatformPaymentMethod(charge.offPlatformPaymentMethod)
    ? charge.offPlatformPaymentMethod
    : null;
  const methodLabel = method ? OFF_PLATFORM_PAYMENT_METHOD_LABELS[method] : "Payment";
  const payId =
    method === "zelle"
      ? charge.partnerZelleId
      : method === "cashapp"
        ? charge.partnerCashappId
        : null;
  const payAccount =
    method === "zelle"
      ? charge.partnerZelleAccount
      : method === "cashapp"
        ? charge.partnerCashappAccount
        : null;
  const reference = charge.paymentReferenceNumber?.trim() || charge.id.slice(0, 8);

  return {
    chargeId: charge.id,
    headline: `${kindLabel} · ${methodLabel} · ${formatUsd(totalCents)}`,
    statusLabel: charge.paidAt ? "Verified payment" : "Payment submitted",
    submittedAtLabel: charge.offPlatformSubmittedAt
      ? submittedLabel(charge.offPlatformSubmittedAt)
      : null,
    vendorName: charge.partnerName?.trim() || kindLabel,
    vendorPhone: charge.partnerPhone,
    payIdLabel:
      method === "zelle"
        ? "Company Zelle ID"
        : method === "cashapp"
          ? "Company Cash App ID"
          : null,
    payId,
    payAccount,
    payerName: charge.offPlatformPayerName,
    paymentReference: charge.paymentReferenceNumber,
    methodKey: method,
    receiptUrl: charge.offPlatformReceiptUrl,
    totalCents,
    lines,
    filename: `shipping-receipt-${filenameSlug(reference)}.pdf`,
  };
}
