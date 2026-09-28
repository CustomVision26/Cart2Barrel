import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingCharges,
  barrelOutboundShippingRefundRequests,
} from "@/db/schema";
import { ensureOutboundShippingRefundRequestsTable } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { insertSupportTicketWithMessage } from "@/data/support-tickets";
import { formatUsd } from "@/lib/admin-markup";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isBarrelOutboundShippingChargeKind,
  isOutboundShippingRefundPath,
  isOutboundShippingRefundStatus,
  outboundPartnerContactLines,
  outboundShippingRefundPath,
  type BarrelOutboundShippingChargeView,
  type OutboundShippingRefundPath,
  type OutboundShippingRefundRequestView,
} from "@/lib/barrel-outbound-shipping-charge";
import { BRAND_NAME } from "@/lib/brand";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";

export async function listOutboundShippingRefundRequestsByChargeIds(
  chargeIds: string[],
): Promise<Map<string, OutboundShippingRefundRequestView>> {
  const byCharge = new Map<string, OutboundShippingRefundRequestView>();
  if (chargeIds.length === 0) return byCharge;
  await ensureOutboundShippingRefundRequestsTable();
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: barrelOutboundShippingRefundRequests.id,
        chargeId: barrelOutboundShippingRefundRequests.chargeId,
        status: barrelOutboundShippingRefundRequests.status,
        refundPath: barrelOutboundShippingRefundRequests.refundPath,
      })
      .from(barrelOutboundShippingRefundRequests)
      .where(inArray(barrelOutboundShippingRefundRequests.chargeId, chargeIds));
    for (const row of rows) {
      if (
        !isOutboundShippingRefundStatus(row.status) ||
        !isOutboundShippingRefundPath(row.refundPath)
      ) {
        continue;
      }
      byCharge.set(row.chargeId, {
        id: row.id,
        status: row.status,
        refundPath: row.refundPath,
      });
    }
  } catch (e) {
    if (!isMissingBarrelOutboundShippingChargesTableError(e)) {
      console.error("[listOutboundShippingRefundRequestsByChargeIds]", e);
    }
  }
  return byCharge;
}

export function attachOutboundShippingRefundRequests<
  T extends { chargeId: string; refundRequest: OutboundShippingRefundRequestView | null },
>(charges: T[], byCharge: Map<string, OutboundShippingRefundRequestView>): T[] {
  return charges.map((charge) => ({
    ...charge,
    refundRequest: byCharge.get(charge.chargeId) ?? null,
  }));
}

function companyRoleLabel(kind: BarrelOutboundShippingChargeView["chargeKind"]): string {
  if (kind === "broker") return "customs broker";
  if (kind === "courier") return "local courier";
  return "freight company";
}

export function companyContactRefundMessage(
  charge: BarrelOutboundShippingChargeView,
): string {
  const company = charge.partnerName?.trim() || "the company that received this payment";
  const role = companyRoleLabel(charge.chargeKind);
  const amount = formatUsd(charge.totalCents);
  const contact = outboundPartnerContactLines(charge);
  const contactBlock =
    contact.length > 0
      ? contact.join("\n")
      : `${company}\nContact details are on file with ${BRAND_NAME}.`;
  return [
    `Thank you for writing to ${BRAND_NAME}. We have recorded your refund request for the ${BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind].toLowerCase()} of ${amount}.`,
    `This payment was made directly to the ${role} by Zelle or Cash App. It was not processed through ${BRAND_NAME}. Please contact the company to request a refund:`,
    contactBlock,
    `${BRAND_NAME} will also reach out to ${company} to encourage a refund on your behalf.`,
  ].join("\n\n");
}

export function amaniRefundMessage(charges: BarrelOutboundShippingChargeView[]): string {
  const total = charges.reduce((sum, charge) => sum + charge.totalCents, 0);
  const labels = charges
    .map((charge) => BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind])
    .join(", ");
  return [
    `${BRAND_NAME} will process a refund of ${formatUsd(total)} for ${labels} on this container.`,
    `Because this charge was paid through ${BRAND_NAME} (including any company billed together with freight), the refund will return to the original payment method used at checkout.`,
    `Our team has been notified and will complete this refund. You do not need to contact the freight company separately.`,
  ].join("\n\n");
}

export async function requestOutboundShippingRefundForCharge(input: {
  clerkUserId: string;
  charge: BarrelOutboundShippingChargeView;
  barrelId: string;
  refundPath: OutboundShippingRefundPath;
  relatedCharges?: BarrelOutboundShippingChargeView[];
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const targets = [input.charge, ...(input.relatedCharges ?? [])].filter(
    (charge, index, list) =>
      list.findIndex((item) => item.chargeId === charge.chargeId) === index,
  );
  const unpaid = targets.filter((charge) => !charge.paidAt);
  if (unpaid.length > 0) {
    return { ok: false, message: "This charge has not been paid." };
  }
  if (targets.some((charge) => charge.refundRequest?.status === "completed")) {
    return { ok: false, message: "This charge has already been refunded." };
  }
  if (targets.every((charge) => charge.refundRequest?.status === "pending")) {
    return {
      ok: true,
      message: "Your refund request is already on file. Our team is following up.",
    };
  }

  await ensureOutboundShippingRefundRequestsTable();
  const db = getDb();
  const now = new Date().toISOString();
  const body =
    input.refundPath === "company_contact"
      ? companyContactRefundMessage(input.charge)
      : amaniRefundMessage(targets);
  const subject =
    input.refundPath === "company_contact"
      ? `Outbound shipping refund — ${input.charge.partnerName?.trim() || BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[input.charge.chargeKind]}`
      : `Outbound shipping refund — ${BRAND_NAME} freight`;

  const ticket = await insertSupportTicketWithMessage({
    clerkUserId: input.clerkUserId,
    subject,
    body,
    isFromStaff: false,
    senderClerkUserId: input.clerkUserId,
  });

  for (const charge of targets) {
    if (charge.refundRequest) continue;
    if (!isBarrelOutboundShippingChargeKind(charge.chargeKind)) continue;
    await db
      .insert(barrelOutboundShippingRefundRequests)
      .values({
        chargeId: charge.chargeId,
        barrelId: input.barrelId,
        clerkUserId: input.clerkUserId,
        chargeKind: charge.chargeKind,
        refundPath: input.refundPath,
        status: "pending",
        amountCents: charge.totalCents,
        supportTicketId: ticket.ticketId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: barrelOutboundShippingRefundRequests.chargeId,
      });
  }

  return {
    ok: true,
    message:
      input.refundPath === "company_contact"
        ? `Please contact the company using the details shown. ${BRAND_NAME} will also reach out to encourage a refund.`
        : `${BRAND_NAME} will process this refund to your original payment method.`,
  };
}

export async function getPaidOutboundChargeRow(input: {
  chargeId: string;
  clerkUserId?: string;
}): Promise<typeof barrelOutboundShippingCharges.$inferSelect | null> {
  const db = getDb();
  const [row] = await db
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
  return row ?? null;
}

export async function fulfillOutboundShippingRefundsForBarrel(input: {
  barrelId: string;
  clerkUserId: string;
  staffClerkUserId: string;
  charges: BarrelOutboundShippingChargeView[];
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const refundable = input.charges.filter((charge) => {
    if (!charge.paidAt) return false;
    if (charge.refundRequest?.status === "completed") return false;
    return outboundShippingRefundPath(charge) != null;
  });
  if (refundable.length === 0) {
    const already = input.charges.some(
      (charge) => charge.refundRequest?.status === "completed",
    );
    return {
      ok: already,
      message: already
        ? "Refunds for this container are already complete."
        : "No paid freight, broker, or courier charge is eligible for a refund on this container.",
    };
  }

  await ensureOutboundShippingRefundRequestsTable();
  const db = getDb();
  const now = new Date().toISOString();
  const { performOutboundShippingStripeRefund } = await import(
    "@/data/perform-outbound-shipping-stripe-refund"
  );

  let stripeRefunds = 0;
  let companyContacts = 0;

  for (const charge of refundable) {
    const path = outboundShippingRefundPath(charge);
    if (!path || !isBarrelOutboundShippingChargeKind(charge.chargeKind)) continue;

    let stripeRefundId: string | null = null;
    if (path === "amani") {
      const stripe = await performOutboundShippingStripeRefund({
        chargeId: charge.chargeId,
        amountCents: charge.totalCents,
      });
      if (!stripe.ok) return stripe;
      stripeRefundId = stripe.stripeRefundId;
      stripeRefunds += 1;
    } else {
      companyContacts += 1;
    }

    const existing = await db
      .select({ id: barrelOutboundShippingRefundRequests.id })
      .from(barrelOutboundShippingRefundRequests)
      .where(eq(barrelOutboundShippingRefundRequests.chargeId, charge.chargeId))
      .limit(1);

    if (existing[0]) {
      await db
        .update(barrelOutboundShippingRefundRequests)
        .set({
          status: "completed",
          stripeRefundId,
          completedAt: now,
          completedByClerkUserId: input.staffClerkUserId,
          updatedAt: now,
        })
        .where(eq(barrelOutboundShippingRefundRequests.id, existing[0].id));
    } else {
      await db.insert(barrelOutboundShippingRefundRequests).values({
        chargeId: charge.chargeId,
        barrelId: input.barrelId,
        clerkUserId: input.clerkUserId,
        chargeKind: charge.chargeKind,
        refundPath: path,
        status: "completed",
        amountCents: charge.totalCents,
        stripeRefundId,
        completedAt: now,
        completedByClerkUserId: input.staffClerkUserId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const parts: string[] = [];
  if (stripeRefunds > 0) {
    parts.push(
      `${BRAND_NAME} issued ${stripeRefunds === 1 ? "a Stripe refund" : `${stripeRefunds} Stripe refunds`} for freight billed on this container.`,
    );
  }
  if (companyContacts > 0) {
    parts.push(
      `Recorded outreach for ${companyContacts === 1 ? "a broker or courier" : `${companyContacts} broker or courier`} payment. Confirm the company refunds the customer directly.`,
    );
  }
  return {
    ok: true,
    message: parts.join(" ") || "Refund line updated.",
  };
}
