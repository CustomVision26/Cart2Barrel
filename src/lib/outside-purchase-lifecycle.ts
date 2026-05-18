import type { ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import { isOutsidePurchaseRequest, outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import { itemRequestStatusLabelForDisplay } from "@/lib/item-request-status-label";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";

/** Snapshot phases that belong on the outside-purchase customer status track. */
export const OUTSIDE_PURCHASE_LIFECYCLE_PHASES = [
  "outside_purchase_intake",
  "outside_purchase_payment_prompted",
  "outside_purchase_added_to_cart",
  "outside_purchase_removed_from_cart",
  "outside_purchase_withdrawn_from_active",
  "outside_purchase_reinstated_to_active",
  "outside_purchase_checkout_paid",
] as const satisfies readonly ItemRequestLineSnapshot["phase"][];

export type OutsidePurchaseLifecyclePhase =
  (typeof OUTSIDE_PURCHASE_LIFECYCLE_PHASES)[number];

export type OutsidePurchaseLifecycleEvent = {
  id: string;
  at: string;
  phase: ItemRequestLineSnapshot["phase"];
  title: string;
  detail: string | null;
};

const LIFECYCLE_PHASE_SET = new Set<string>(OUTSIDE_PURCHASE_LIFECYCLE_PHASES);

export function isOutsidePurchaseLifecyclePhase(
  phase: ItemRequestLineSnapshot["phase"],
): phase is OutsidePurchaseLifecyclePhase {
  return LIFECYCLE_PHASE_SET.has(phase);
}

function legacyOutsidePurchaseLifecycleEvent(
  snap: ItemRequestLineSnapshot,
): OutsidePurchaseLifecycleEvent | null {
  const memo = snap.auditMemo?.trim() ?? "";
  if (snap.phase === "removed_from_cart") {
    return {
      id: snap.id,
      at: snap.createdAt,
      phase: snap.phase,
      title: "Removed from cart",
      detail: memo || "Product left the cart.",
    };
  }
  if (snap.phase === "customer_line_edit") {
    if (/reinstated/i.test(memo)) {
      return {
        id: snap.id,
        at: snap.createdAt,
        phase: snap.phase,
        title: "Reinstated to Active",
        detail: memo,
      };
    }
    if (/withdrawn|removed this request from the products tab/i.test(memo)) {
      return {
        id: snap.id,
        at: snap.createdAt,
        phase: snap.phase,
        title: "Removed from Active",
        detail: memo,
      };
    }
  }
  return null;
}

export function outsidePurchaseLifecycleEventTitle(
  phase: ItemRequestLineSnapshot["phase"],
  auditMemo?: string | null,
): string {
  switch (phase) {
    case "outside_purchase_intake":
      return "Sent to customer by staff";
    case "outside_purchase_payment_prompted":
      return "Payment due · staff prompted customer";
    case "outside_purchase_added_to_cart":
      return "Added to cart";
    case "outside_purchase_removed_from_cart":
      return auditMemo?.toLowerCase().includes("permanent") ?
          "Permanently removed from cart"
        : "Moved back from cart to Active";
    case "outside_purchase_withdrawn_from_active":
      return "Removed from Active";
    case "outside_purchase_reinstated_to_active":
      return "Reinstated to Active";
    case "outside_purchase_checkout_paid":
      return PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL;
    default:
      return auditMemo?.trim() || "Status update";
  }
}

export function buildOutsidePurchaseLifecycleEvents(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
): OutsidePurchaseLifecycleEvent[] {
  if (!isOutsidePurchaseRequest(request)) return [];

  const events: OutsidePurchaseLifecycleEvent[] = [];

  for (const snap of snapshots) {
    if (isOutsidePurchaseLifecyclePhase(snap.phase)) {
      events.push({
        id: snap.id,
        at: snap.createdAt,
        phase: snap.phase,
        title: outsidePurchaseLifecycleEventTitle(snap.phase, snap.auditMemo),
        detail: snap.auditMemo?.trim() || null,
      });
      continue;
    }
    const legacy = legacyOutsidePurchaseLifecycleEvent(snap);
    if (legacy) events.push(legacy);
  }

  events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  return events;
}

export function outsidePurchaseCurrentStatusLabel(request: ItemRequest): string {
  return itemRequestStatusLabelForDisplay(request);
}

export function outsidePurchaseReferenceLabel(
  request: Pick<ItemRequest, "outsidePurchaseReference" | "productUrl" | "source">,
): string | null {
  return outsidePurchaseReferenceDisplay(request);
}
