"use server";

import { revalidatePath } from "next/cache";

import {
  getMerchandiseReconciliationByOrderItemId,
  getPaidPendingPurchaseLineContext,
  markMerchandiseReconciliationCancelled,
  markMerchandiseReconciliationCustomerNotified,
  markMerchandiseReconciliationTopupPaid,
  markMerchandiseReconciliationTopupPending,
  resolveBatchReconciliationOrderItemIds,
  revokeMerchandiseReconciliationTopupPending,
  upsertMerchandiseReconciliationForOrderItemIds,
} from "@/data/order-item-merchandise-reconciliations";
import { getProfileByClerkId } from "@/data/profiles";
import {
  appendSupportTicketMessage,
  resolveMerchandisePriceDialogueTicket,
  type SupportTicketMessageRow,
} from "@/data/support-tickets";
import { normalizeSupportTicketImageUrls } from "@/lib/support-ticket-images";
import { performOrderItemStripeRefund } from "@/data/perform-order-item-stripe-refund";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { insertSupportTicketWithMessage } from "@/data/support-tickets";
import {
  recordMerchandisePriceChangeActivity,
  recordMerchandiseTopupRequiredActivity,
} from "@/data/user-status-update-events";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import type { MerchantServiceTierRow } from "@/lib/admin-markup";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  composeMerchandiseAutoTopupMessage,
  defaultMerchandiseAdditionalTopupMessage,
  defaultMerchandiseCancelRefundMessage,
  defaultMerchandiseTopupMessage,
  defaultMerchandiseTopupRevokedMessage,
  formatMerchandiseTopupNumber,
  merchandiseTopupPaidNetCents,
  remainingMerchandiseTopupCents,
  type MerchandiseReconciliationView,
} from "@/lib/merchandise-reconciliation";
import { revalidateCompanyPurchasePaths } from "@/lib/revalidate-company-purchase-paths";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  cancelMerchandiseReconciliationSchema,
  getMerchandiseReconciliationSchema,
  markMerchandiseTopupPaidSchema,
  notifyMerchandisePriceChangeSchema,
  recordMerchandiseReconciliationSchema,
  requestMerchandiseTopupSchema,
  revokeMerchandiseTopupSchema,
} from "@/lib/validations/merchandise-reconciliation";

export type MerchandiseReconciliationActionState =
  | { ok: true; message: string; reconciliation: MerchandiseReconciliationView }
  | { ok: false; message: string };

export type RevokeMerchandiseTopupActionState =
  | {
      ok: true;
      message: string;
      reconciliation: MerchandiseReconciliationView;
      /** Draft for admin to review/send — not posted automatically. */
      draftCustomerMessage: string;
    }
  | { ok: false; message: string };

export type GetMerchandiseReconciliationState =
  | {
      ok: true;
      reconciliation: MerchandiseReconciliationView | null;
      serviceTiers: MerchantServiceTierRow[];
      customerDisplayName: string | null;
      ticketMessages: SupportTicketMessageRow[];
      supportTicketId: string | null;
      /** Merchandise (original) order id for paid top-up templates. */
      merchandiseOrderId: string | null;
      /** Frozen per-installment top-up breakdowns (never overwritten). */
      topupBreakdowns: import("@/data/merchandise-topup-charge-breakdowns").MerchandiseTopupChargeBreakdownView[];
    }
  | { ok: false; message: string };

function revalidateMerchandisePaths(): void {
  revalidateCompanyPurchasePaths();
  revalidatePath("/admin/support", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/support", "layout");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/items/new/add-item", "layout");
}

async function requireAdmin() {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return null;
  }
  return cu.user;
}

async function syncCustomerNotified(
  orderItemIds: string[],
  clerkUserId: string,
  supportTicketId: string,
  customerMessage: string,
  adminClerkUserId: string,
  preserveStatus?: boolean,
): Promise<void> {
  for (const orderItemId of orderItemIds) {
    await markMerchandiseReconciliationCustomerNotified({
      orderItemId,
      clerkUserId,
      supportTicketId,
      customerMessage,
      adminClerkUserId,
      preserveStatus,
    });
  }
}

export async function getMerchandiseReconciliationAction(
  raw: unknown,
): Promise<GetMerchandiseReconciliationState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = getMerchandiseReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const [reconciliation, line] = await Promise.all([
    getMerchandiseReconciliationByOrderItemId(parsed.data.orderItemId),
    getPaidPendingPurchaseLineContext(parsed.data.orderItemId),
  ]);
  const pricing = await getMerchantPricingForEstimates(line?.clerkUserId);
  const profile =
    line?.clerkUserId ? await getProfileByClerkId(line.clerkUserId) : null;
  const customerDisplayName = profile?.fullName?.trim() || null;

  let ticketMessages: SupportTicketMessageRow[] = [];
  let supportTicketId = reconciliation?.supportTicketId ?? null;
  if (line?.clerkUserId) {
    const orderItemIds = Array.from(
      new Set([
        parsed.data.orderItemId,
        ...(parsed.data.relatedOrderItemIds ?? []),
      ]),
    );
    const dialogue = await resolveMerchandisePriceDialogueTicket({
      clerkUserId: line.clerkUserId,
      preferredTicketId: supportTicketId,
      orderItemIds,
    });
    if (dialogue) {
      supportTicketId = dialogue.id;
      ticketMessages = dialogue.messages;
    } else {
      // Contaminated or missing scope ticket — do not show another scope's thread.
      supportTicketId = null;
    }
  }

  let topupBreakdowns: import("@/data/merchandise-topup-charge-breakdowns").MerchandiseTopupChargeBreakdownView[] =
    [];
  if (reconciliation && line?.clerkUserId) {
    const { ensureLegacyPaidTopupBreakdownIfMissing } = await import(
      "@/data/merchandise-topup-charge-breakdowns"
    );
    topupBreakdowns = (
      await ensureLegacyPaidTopupBreakdownIfMissing({
        clerkUserId: line.clerkUserId,
        reconciliation,
      })
    ).filter((b) => b.status === "paid" || b.status === "pending");
  }

  return {
    ok: true,
    reconciliation,
    serviceTiers: [...pricing.serviceTiers],
    customerDisplayName,
    ticketMessages,
    supportTicketId,
    merchandiseOrderId: line?.orderId ?? null,
    topupBreakdowns,
  };
}

export async function recordMerchandiseReconciliationAction(
  raw: unknown,
): Promise<MerchandiseReconciliationActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = recordMerchandiseReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid reconciliation.",
    };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  try {
    const isBatch = scope.orderItemIds.length > 1;
    // Batch: S&H stays at checkout (already the sum of each product’s fee).
    // Single: trust the admin-edited actualServiceCents from the client.
    const actualServiceCents =
      isBatch ?
        Math.max(0, Math.round(parsed.data.checkoutServiceCents))
      : parsed.data.actualServiceCents;

    const reconciliation = await upsertMerchandiseReconciliationForOrderItemIds({
      orderItemIds: scope.orderItemIds,
      clerkUserId: scope.clerkUserId,
      checkoutMerchandiseCents: parsed.data.checkoutMerchandiseCents,
      checkoutShippingCents: parsed.data.checkoutShippingCents,
      checkoutTaxCents: parsed.data.checkoutTaxCents,
      checkoutServiceCents: parsed.data.checkoutServiceCents,
      actualMerchandiseCents: parsed.data.actualMerchandiseCents,
      actualShippingCents: parsed.data.actualShippingCents,
      actualTaxCents: parsed.data.actualTaxCents,
      actualServiceCents,
      adminClerkUserId: admin.id,
    });
    revalidateMerchandisePaths();
    const batchNote =
      scope.orderItemIds.length > 1 ? " for this batch" : "";
    const deltaMsg =
      reconciliation.deltaCents === 0 ?
        `Charges match checkout — you may approve purchase${batchNote}.`
      : reconciliation.deltaCents > 0 ?
        "Charges increased — message the customer, then request a top-up or cancel + refund."
      : "Charges dropped — do not buy. Cancel and refund.";
    return { ok: true, message: deltaMsg, reconciliation };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save reconciliation.",
    };
  }
}

export async function notifyMerchandisePriceChangeAction(
  raw: unknown,
): Promise<MerchandiseReconciliationActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = notifyMerchandisePriceChangeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid message.",
    };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  const line = await getPaidPendingPurchaseLineContext(parsed.data.orderItemId);
  if (!line) {
    return { ok: false, message: "Order line not found." };
  }

  const existing = await getMerchandiseReconciliationByOrderItemId(
    parsed.data.orderItemId,
  );
  if (!existing || existing.deltaCents === 0) {
    return {
      ok: false,
      message: "Record a merchandise price difference before notifying the customer.",
    };
  }
  if (existing.status === "cancelled") {
    return { ok: false, message: "This line was already cancelled." };
  }

  const isBatchScope = scope.orderItemIds.length > 1;
  const productLabel =
    isBatchScope ?
      "batch order"
    : line.productName?.trim() || "Order product";

  try {
    const imageUrls = normalizeSupportTicketImageUrls(parsed.data.imageUrls);
    // Scope-locked: only reuse a ticket already linked to these order lines.
    const dialogue = await resolveMerchandisePriceDialogueTicket({
      clerkUserId: line.clerkUserId,
      preferredTicketId: existing.supportTicketId,
      orderItemIds: scope.orderItemIds,
    });
    let ticketId = dialogue?.id ?? null;

    // Append within this scope’s dialogue; otherwise open a new thread.
    if (ticketId) {
      await appendSupportTicketMessage({
        ticketId,
        senderClerkUserId: admin.id,
        isFromStaff: true,
        body: parsed.data.message,
        imageUrls,
        nextStatus: "awaiting_customer",
      });
    } else {
      const created = await insertSupportTicketWithMessage({
        clerkUserId: line.clerkUserId,
        subject: `Purchase price update — ${productLabel}`,
        body: parsed.data.message,
        imageUrls,
        isFromStaff: true,
        senderClerkUserId: admin.id,
        status: "awaiting_customer",
        productLinks: [],
      });
      ticketId = created.ticketId;
    }

    await syncCustomerNotified(
      scope.orderItemIds,
      line.clerkUserId,
      ticketId,
      parsed.data.message,
      admin.id,
    );

    const reconciliation =
      (await getMerchandiseReconciliationByOrderItemId(parsed.data.orderItemId))!;

    await recordMerchandisePriceChangeActivity({
      clerkUserId: line.clerkUserId,
      orderId: line.orderId,
      orderItemId: line.orderItemId,
      productName:
        scope.orderItemIds.length > 1 ? "Batch order" : line.productName,
      body: "Staff needs your decision on a retailer price change.",
      supportTicketId: ticketId,
    });

    revalidateMerchandisePaths();
    return {
      ok: true,
      message: "Customer notified. Await their directive, then choose top-up or cancel.",
      reconciliation,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not notify customer.",
    };
  }
}

export async function requestMerchandiseTopupAction(
  raw: unknown,
): Promise<MerchandiseReconciliationActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = requestMerchandiseTopupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid top-up request.",
    };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  const line = await getPaidPendingPurchaseLineContext(parsed.data.orderItemId);
  if (!line) {
    return { ok: false, message: "Order line not found." };
  }

  const existing = await getMerchandiseReconciliationByOrderItemId(
    parsed.data.orderItemId,
  );
  const paidNetCents = existing ? merchandiseTopupPaidNetCents(existing) : 0;
  const remainingTopupCents =
    existing ?
      remainingMerchandiseTopupCents({
        grossDeltaCents: existing.deltaCents,
        paidNetCents,
      })
    : 0;
  if (!existing || remainingTopupCents <= 0) {
    return {
      ok: false,
      message:
        paidNetCents > 0 ?
          "No additional top-up is due after the amount already paid."
        : "Top-up only applies when live merchandise is higher than checkout.",
    };
  }
  if (
    existing.status !== "customer_notified" &&
    existing.status !== "topup_pending" &&
    existing.status !== "recorded"
  ) {
    return {
      ok: false,
      message:
        "Record the price difference (and optionally message the customer) before requesting a top-up.",
    };
  }

  try {
    let reconciliation: MerchandiseReconciliationView | null = null;
    for (const orderItemId of scope.orderItemIds) {
      reconciliation = await markMerchandiseReconciliationTopupPending({
        orderItemId,
        clerkUserId: line.clerkUserId,
        topupAmountCents: remainingTopupCents,
        expiryHours: parsed.data.expiryHours,
        adminClerkUserId: admin.id,
      });
    }
    if (!reconciliation) {
      return { ok: false, message: "Could not request top-up." };
    }

    const expiresAt = reconciliation.topupExpiresAt ?? new Date().toISOString();

    // Freeze this installment's charge breakdown (never overwrite prior ones).
    const {
      insertMerchandiseTopupChargeBreakdown,
      merchandiseTopupBreakdownGroupKey,
    } = await import("@/data/merchandise-topup-charge-breakdowns");
    await insertMerchandiseTopupChargeBreakdown({
      clerkUserId: line.clerkUserId,
      groupKey: merchandiseTopupBreakdownGroupKey({
        supportTicketId: existing.supportTicketId ?? reconciliation.supportTicketId,
        reconciliationId: existing.id,
      }),
      reconciliationId: existing.id,
      checkoutMerchandiseCents: existing.checkoutMerchandiseCents,
      checkoutShippingCents: existing.checkoutShippingCents,
      checkoutTaxCents: existing.checkoutTaxCents,
      checkoutServiceCents: existing.checkoutServiceCents,
      actualMerchandiseCents: existing.actualMerchandiseCents,
      actualShippingCents: existing.actualShippingCents,
      actualTaxCents: existing.actualTaxCents,
      actualServiceCents: existing.actualServiceCents,
      deltaCents: existing.deltaCents,
      amountCents: remainingTopupCents,
      priorPaidNetCents: paidNetCents,
      topupExpiresAt: expiresAt,
      createdByClerkUserId: admin.id,
    });

    const productLabel =
      scope.orderItemIds.length > 1 ?
        "your batch order"
      : (line.productName ?? "your product");
    const shouldPostMessage = parsed.data.postCustomerMessage !== false;

    if (shouldPostMessage) {
      const chargeDetail = parsed.data.customerMessage?.trim();
      const topupBody =
        chargeDetail ?
          composeMerchandiseAutoTopupMessage({
            chargeDetailMessage: chargeDetail,
            topupAmountCents: remainingTopupCents,
            expiresAtIso: expiresAt,
            productName: productLabel,
          })
        : paidNetCents > 0 ?
          defaultMerchandiseAdditionalTopupMessage({
            productName: productLabel,
            topupNumber: formatMerchandiseTopupNumber(existing.id),
            additionalTopupCents: remainingTopupCents,
            priorPaidTopupCents: paidNetCents,
            checkoutSubtotalCents: line.linePriceCents,
            merchandiseOrderId: line.orderId,
            expiresAtIso: expiresAt,
            batchNumber: scope.orderItemIds.length > 1 ? "batch order" : null,
          })
        : defaultMerchandiseTopupMessage({
            productName: productLabel,
            topupAmountCents: remainingTopupCents,
            expiresAtIso: expiresAt,
          });

      const dialogue = await resolveMerchandisePriceDialogueTicket({
        clerkUserId: line.clerkUserId,
        preferredTicketId: existing.supportTicketId,
        orderItemIds: scope.orderItemIds,
      });
      let ticketId = dialogue?.id ?? null;

      if (ticketId) {
        const { appendSupportTicketMessage } = await import(
          "@/data/support-tickets"
        );
        await appendSupportTicketMessage({
          ticketId,
          senderClerkUserId: admin.id,
          isFromStaff: true,
          body: topupBody,
          nextStatus: "awaiting_customer",
        });
      } else {
        const created = await insertSupportTicketWithMessage({
          clerkUserId: line.clerkUserId,
          subject:
            scope.orderItemIds.length > 1 ?
              "Price increased — batch pay extra charge"
            : "Price increased — pay extra charge",
          body: topupBody,
          isFromStaff: true,
          senderClerkUserId: admin.id,
          status: "awaiting_customer",
        });
        ticketId = created.ticketId;
      }

      await syncCustomerNotified(
        scope.orderItemIds,
        line.clerkUserId,
        ticketId,
        topupBody,
        admin.id,
        true,
      );
    }

    await recordMerchandiseTopupRequiredActivity({
      clerkUserId: line.clerkUserId,
      orderId: line.orderId,
      orderItemId: line.orderItemId,
      productName:
        scope.orderItemIds.length > 1 ? "Batch order" : line.productName,
      topupAmountCents: remainingTopupCents,
      expiresAtIso: expiresAt,
    });

    const refreshed =
      (await getMerchandiseReconciliationByOrderItemId(parsed.data.orderItemId)) ??
      reconciliation;

    revalidateMerchandisePaths();
    return {
      ok: true,
      message:
        shouldPostMessage ?
          "Top-up requested. Mark it paid once the customer pays, then approve purchase."
        : "Top-up charge created. Send the Agree to pay message when ready.",
      reconciliation: refreshed,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not request top-up.",
    };
  }
}

export async function markMerchandiseTopupPaidAction(
  raw: unknown,
): Promise<MerchandiseReconciliationActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = markMerchandiseTopupPaidSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  const existing = await getMerchandiseReconciliationByOrderItemId(
    parsed.data.orderItemId,
  );
  if (!existing || existing.status !== "topup_pending") {
    return {
      ok: false,
      message: "No unpaid merchandise top-up is pending for this batch/line.",
    };
  }

  try {
    let reconciliation: MerchandiseReconciliationView | null = null;
    for (const orderItemId of scope.orderItemIds) {
      reconciliation = await markMerchandiseReconciliationTopupPaid({
        orderItemId,
        clerkUserId: scope.clerkUserId,
        adminClerkUserId: admin.id,
      });
    }
    if (!reconciliation) {
      return { ok: false, message: "Could not mark top-up paid." };
    }

    const { clearMerchandiseTopupCartForReconciliations } = await import(
      "@/data/merchandise-topup-cart"
    );
    const { notifyCustomerMerchandiseTopupPaid } = await import(
      "@/data/notify-merchandise-topup-paid"
    );
    const reconIds: string[] = [];
    for (const orderItemId of scope.orderItemIds) {
      const row = await getMerchandiseReconciliationByOrderItemId(orderItemId);
      if (row?.id) reconIds.push(row.id);
    }
    if (reconIds.length === 0 && existing.id) reconIds.push(existing.id);
    await clearMerchandiseTopupCartForReconciliations(
      scope.clerkUserId,
      reconIds,
    );
    await notifyCustomerMerchandiseTopupPaid({
      clerkUserId: scope.clerkUserId,
      reconciliationIds: reconIds,
      staffClerkUserId: admin.id,
    });

    revalidateMerchandisePaths();
    return {
      ok: true,
      message: "Top-up marked paid. You may approve the company purchase.",
      reconciliation,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not mark top-up paid.",
    };
  }
}

/**
 * Revoke an unpaid top-up add-on (hide from Products Active). Does not post a
 * support message — returns a draft for the admin to send.
 */
export async function revokeMerchandiseTopupAction(
  raw: unknown,
): Promise<RevokeMerchandiseTopupActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = revokeMerchandiseTopupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  const existing = await getMerchandiseReconciliationByOrderItemId(
    parsed.data.orderItemId,
  );
  if (!existing || existing.status !== "topup_pending") {
    return {
      ok: false,
      message: "No unpaid top-up add-on request to revoke.",
    };
  }

  const line = await getPaidPendingPurchaseLineContext(parsed.data.orderItemId);
  const revokedAmountCents = Math.max(0, existing.topupAmountCents ?? 0);

  try {
    let reconciliation: MerchandiseReconciliationView | null = null;
    const reconIds: string[] = [];
    for (const orderItemId of scope.orderItemIds) {
      reconciliation = await revokeMerchandiseReconciliationTopupPending({
        orderItemId,
        clerkUserId: scope.clerkUserId,
        adminClerkUserId: admin.id,
      });
      if (reconciliation?.id) reconIds.push(reconciliation.id);
    }
    if (!reconciliation) {
      return { ok: false, message: "Could not revoke top-up request." };
    }
    if (reconIds.length === 0 && existing.id) reconIds.push(existing.id);

    const { clearMerchandiseTopupCartForReconciliations } = await import(
      "@/data/merchandise-topup-cart"
    );
    await clearMerchandiseTopupCartForReconciliations(
      scope.clerkUserId,
      reconIds,
    );

    const {
      merchandiseTopupBreakdownGroupKey,
      revokePendingMerchandiseTopupChargeBreakdowns,
    } = await import("@/data/merchandise-topup-charge-breakdowns");
    await revokePendingMerchandiseTopupChargeBreakdowns({
      clerkUserId: scope.clerkUserId,
      groupKey: merchandiseTopupBreakdownGroupKey({
        supportTicketId: existing.supportTicketId,
        reconciliationId: existing.id,
      }),
    });

    const productLabel =
      scope.orderItemIds.length > 1 ?
        "your batch order"
      : (line?.productName ?? "your product");
    const draftCustomerMessage = defaultMerchandiseTopupRevokedMessage({
      productName: productLabel,
      topupNumber: formatMerchandiseTopupNumber(existing.id),
      topupAmountCents: revokedAmountCents,
      isBatch: scope.orderItemIds.length > 1,
    });

    revalidateMerchandisePaths();
    return {
      ok: true,
      message:
        "Top-up add-on revoked. Review the drafted message and send when ready.",
      reconciliation,
      draftCustomerMessage,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not revoke top-up.",
    };
  }
}

export async function cancelMerchandiseReconciliationWithRefundAction(
  raw: unknown,
): Promise<MerchandiseReconciliationActionState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = cancelMerchandiseReconciliationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid cancel request.",
    };
  }

  const scope = await resolveBatchReconciliationOrderItemIds({
    orderItemId: parsed.data.orderItemId,
    relatedOrderItemIds: parsed.data.relatedOrderItemIds,
  });
  if (!scope.ok) {
    return { ok: false, message: scope.message };
  }

  const line = await getPaidPendingPurchaseLineContext(parsed.data.orderItemId);
  if (!line) {
    return { ok: false, message: "Order line not found." };
  }

  let existing = await getMerchandiseReconciliationByOrderItemId(
    parsed.data.orderItemId,
  );
  if (!existing) {
    return {
      ok: false,
      message: "Record actual merchandise cost before cancelling for a price change.",
    };
  }
  if (existing.status === "cancelled") {
    return { ok: false, message: "This line was already cancelled." };
  }
  const paidTopupNet = merchandiseTopupPaidNetCents(existing);
  if (existing.deltaCents === 0 && paidTopupNet < 1) {
    return {
      ok: false,
      message:
        "Retailer costs match checkout — use a normal refund if needed, not price-change cancel.",
    };
  }

  const contexts = await Promise.all(
    scope.orderItemIds.map((id) => getPaidPendingPurchaseLineContext(id)),
  );
  const validContexts = contexts.filter(
    (c): c is NonNullable<typeof c> => c != null,
  );
  if (validContexts.length !== scope.orderItemIds.length) {
    return { ok: false, message: "Could not load all batch lines for refund." };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds(scope.orderItemIds);
  const refundableById = validContexts.map((c) =>
    Math.max(0, c.linePriceCents - (refundedMap.get(c.orderItemId) ?? 0)),
  );
  const totalRefundable = refundableById.reduce((a, b) => a + b, 0);

  const {
    listMerchandiseTopupRefundablesForOrderItems,
    performMerchandiseTopupStripeRefund,
    recordMerchandiseTopupPayment,
  } = await import("@/data/merchandise-topup-refund");

  // Ensure payment ledger rows exist so paid top-up add-ons can be refunded
  // (covers admin mark-paid / older checkouts that never wrote the ledger).
  const reconIdsForTopup: string[] = [];
  const topupCheckoutGroups = new Map<
    string,
    { reconciliationIds: string[]; amountCents: number; paidAt?: string }
  >();
  for (const orderItemId of scope.orderItemIds) {
    const recon = await getMerchandiseReconciliationByOrderItemId(orderItemId);
    if (!recon) continue;
    reconIdsForTopup.push(recon.id);
    const net = merchandiseTopupPaidNetCents(recon);
    if (net < 1 || !recon.topupCheckoutOrderId) continue;
    const group = topupCheckoutGroups.get(recon.topupCheckoutOrderId);
    if (group) {
      if (!group.reconciliationIds.includes(recon.id)) {
        group.reconciliationIds.push(recon.id);
      }
      // Batch siblings share one checkout; amount is the installment total (not a sum).
      group.amountCents = Math.max(group.amountCents, net);
      if (!group.paidAt && recon.topupPaidAt) group.paidAt = recon.topupPaidAt;
    } else {
      topupCheckoutGroups.set(recon.topupCheckoutOrderId, {
        reconciliationIds: [recon.id],
        amountCents: net,
        paidAt: recon.topupPaidAt ?? undefined,
      });
    }
  }
  for (const [checkoutOrderId, group] of topupCheckoutGroups) {
    await recordMerchandiseTopupPayment({
      clerkUserId: scope.clerkUserId,
      checkoutOrderId,
      amountCents: group.amountCents,
      reconciliationIds: group.reconciliationIds,
      paidAt: group.paidAt,
    });
  }

  const topups = await listMerchandiseTopupRefundablesForOrderItems({
    clerkUserId: scope.clerkUserId,
    orderItemIds: scope.orderItemIds,
  });
  const topupRefundableTotal = topups.reduce(
    (sum, t) => sum + Math.max(0, t.refundableCents),
    0,
  );

  if (totalRefundable < 1 && topupRefundableTotal < 1) {
    return { ok: false, message: "Nothing left to refund on this batch/line." };
  }

  const refundCentsTotal = Math.min(
    parsed.data.refundAmountCents,
    Math.max(totalRefundable, 0),
  );
  const perLineRefund = allocateCentsByWeight(refundCentsTotal, refundableById);
  const reason =
    parsed.data.reason?.trim() ||
    (scope.orderItemIds.length > 1 ?
      "Retailer merchandise price change — batch cancelled"
    : "Retailer merchandise price change — line cancelled");

  let refundedTotal = 0;
  let topupRefundedTotal = 0;
  for (let i = 0; i < validContexts.length; i++) {
    const amount = perLineRefund[i] ?? 0;
    if (amount < 1) continue;
    const refundResult = await performOrderItemStripeRefund({
      orderItemId: validContexts[i]!.orderItemId,
      amountCentsRequested: amount,
      internalReasonForDb: reason,
      stripeReason: "requested_by_customer",
      createdByClerkUserId: admin.id,
    });
    if (!refundResult.ok) {
      return {
        ok: false,
        message:
          refundedTotal > 0 ?
            `Partial refund issued (${refundedTotal}¢) then failed: ${refundResult.message}`
          : refundResult.message,
      };
    }
    refundedTotal += refundResult.refundedCents;
  }

  // Always refund paid purchase-price top-up add-ons for this line / batch.
  for (const topup of topups) {
    if (topup.refundableCents < 1) continue;
    const topupResult = await performMerchandiseTopupStripeRefund({
      paymentId: topup.paymentId,
      topupCheckoutOrderId: topup.topupCheckoutOrderId,
      reconciliationIds:
        topup.reconciliationIds.length > 0 ?
          topup.reconciliationIds
        : reconIdsForTopup,
      amountCentsRequested: topup.refundableCents,
      internalReasonForDb: `${reason} (top-up add-on)`,
      createdByClerkUserId: admin.id,
    });
    if (!topupResult.ok) {
      return {
        ok: false,
        message:
          refundedTotal > 0 || topupRefundedTotal > 0 ?
            `Merchandise refunded (${refundedTotal}¢) but top-up add-on refund failed: ${topupResult.message}`
          : topupResult.message,
      };
    }
    topupRefundedTotal += topupResult.refundedCents;
    refundedTotal += topupResult.refundedCents;
  }

  try {
    for (const orderItemId of scope.orderItemIds) {
      existing = await markMerchandiseReconciliationCancelled({
        orderItemId,
        clerkUserId: scope.clerkUserId,
        adminClerkUserId: admin.id,
      });
    }
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ?
          `Refund issued but could not mark reconciliation cancelled: ${e.message}`
        : "Refund issued but reconciliation update failed.",
    };
  }

  const cancelBody = defaultMerchandiseCancelRefundMessage({
    productName:
      scope.orderItemIds.length > 1 ?
        "your batch order"
      : (line.productName ?? "your product"),
    refundCents: refundedTotal,
  });

  try {
    let supportTicketId = existing.supportTicketId;
    if (supportTicketId) {
      const { appendSupportTicketMessage } = await import(
        "@/data/support-tickets"
      );
      await appendSupportTicketMessage({
        ticketId: supportTicketId,
        senderClerkUserId: admin.id,
        isFromStaff: true,
        body: cancelBody,
      });
    } else {
      const created = await insertSupportTicketWithMessage({
        clerkUserId: line.clerkUserId,
        subject: "Order cancelled — refund",
        body: cancelBody,
        isFromStaff: true,
        senderClerkUserId: admin.id,
        status: "awaiting_customer",
      });
      supportTicketId = created.ticketId;
    }

    await recordMerchandisePriceChangeActivity({
      clerkUserId: line.clerkUserId,
      orderId: line.orderId,
      orderItemId: line.orderItemId,
      productName:
        scope.orderItemIds.length > 1 ? "Batch order" : line.productName,
      body: cancelBody,
      supportTicketId,
    });
  } catch (e) {
    console.error(
      "[Amani Cart2Barrel] cancel reconciliation messaging failed after refund:",
      e,
    );
  }

  revalidateMerchandisePaths();
  const topupNote =
    topupRefundedTotal > 0 ?
      ` (includes ${topupRefundedTotal}¢ top-up add-on)`
    : "";
  return {
    ok: true,
    message: `Cancelled and refunded ${refundedTotal}¢${topupNote}. Customer notified about refund timing.`,
    reconciliation: existing,
  };
}
