import type { ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";

export type OutsidePurchasePublishedRequest = Pick<
  ItemRequest,
  "source" | "outsidePurchasePublishedAt" | "createdAt"
>;

/** Customer-facing Active tab: outside-purchase lines require staff publish. */
export function isOutsidePurchasePublishedToCustomer(
  request: OutsidePurchasePublishedRequest,
): boolean {
  if (request.source !== "outside_purchase") return true;
  if (!("outsidePurchasePublishedAt" in request)) {
    return true;
  }
  return request.outsidePurchasePublishedAt != null;
}

/** Admin pool: quoted outside purchase not yet visible to the customer. */
export function isOutsidePurchaseAdminDraft(
  request: Pick<ItemRequest, "source" | "status" | "outsidePurchasePublishedAt">,
): boolean {
  return (
    request.source === "outside_purchase" &&
    request.status === "quoted" &&
    request.outsidePurchasePublishedAt == null
  );
}

/** Admin intake edit dialog — only while the line is not live on the customer's Active tab. */
export function outsidePurchaseAllowsAdminIntakeEdit(
  request: Pick<ItemRequest, "source" | "status" | "outsidePurchasePublishedAt">,
): boolean {
  return (
    request.source === "outside_purchase" &&
    request.status === "quoted" &&
    request.outsidePurchasePublishedAt == null
  );
}

/** Customer reinstate: republish when staff had published this line before admin withdraw. */
export function outsidePurchaseWasPublishedToCustomerBefore(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase">[],
): boolean {
  return snapshots.some((snap) => snap.phase === "outside_purchase_published");
}

const OUTSIDE_PURCHASE_CUSTOMER_ACTIVE_HISTORY_PHASES = [
  "outside_purchase_published",
  "outside_purchase_unpublished",
  "outside_purchase_withdrawn_from_active",
  "outside_purchase_reinstated_to_active",
] as const satisfies readonly ItemRequestLineSnapshot["phase"][];

/** Customer had this line on Active before (publish, withdraw, remove, or reinstate). */
export function outsidePurchaseHadBeenOnCustomerActiveBefore(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase">[],
): boolean {
  return snapshots.some((snap) =>
    (OUTSIDE_PURCHASE_CUSTOMER_ACTIVE_HISTORY_PHASES as readonly string[]).includes(
      snap.phase,
    ),
  );
}

/** Latest staff/customer visibility decision on the outside-purchase lifecycle track. */
export function latestOutsidePurchaseVisibilityPhase(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[],
): ItemRequestLineSnapshot["phase"] | null {
  let latest: { phase: ItemRequestLineSnapshot["phase"]; at: number } | null =
    null;

  for (const snap of snapshots) {
    if (
      !(OUTSIDE_PURCHASE_CUSTOMER_ACTIVE_HISTORY_PHASES as readonly string[]).includes(
        snap.phase,
      )
    ) {
      continue;
    }
    const at = new Date(snap.createdAt).getTime();
    if (!latest || at > latest.at) {
      latest = { phase: snap.phase, at };
    }
  }

  return latest?.phase ?? null;
}

/**
 * Active-tab load repair: republish only when the latest visibility snapshot says
 * the customer should still see the line. Staff `outside_purchase_unpublished`
 * must win over an earlier publish.
 */
export function outsidePurchaseNeedsCustomerVisibilityRepair(
  snapshots: readonly Pick<ItemRequestLineSnapshot, "phase" | "createdAt">[],
): boolean {
  const latest = latestOutsidePurchaseVisibilityPhase(snapshots);
  return (
    latest === "outside_purchase_published" ||
    latest === "outside_purchase_reinstated_to_active"
  );
}

/** Unpublished quoted line — staff can publish even when checkout limits other admin actions. */
export function outsidePurchaseAdminNeedsPublishToCustomer(
  request: Pick<ItemRequest, "source" | "status" | "outsidePurchasePublishedAt">,
): boolean {
  return isOutsidePurchaseAdminDraft(request);
}

/** When to show the Workflow block on admin outside-purchase rows. */
export function outsidePurchaseAdminShowsWorkflowSection(
  request: Pick<ItemRequest, "source" | "status" | "outsidePurchasePublishedAt">,
  limitedActions: boolean,
  options?: {
    showPublishedReturnEstimateWorkflow?: boolean;
  },
): boolean {
  if (request.source !== "outside_purchase" || request.status !== "quoted") {
    return false;
  }
  if (!limitedActions) return true;
  if (options?.showPublishedReturnEstimateWorkflow) return true;
  return outsidePurchaseAdminNeedsPublishToCustomer(request);
}

/**
 * After checkout or payment, admin row actions are limited to audit + charge review.
 */
export function isOutsidePurchaseAdminActionsLimited(
  request: Pick<ItemRequest, "status" | "source">,
  orderContext?: ItemRequestOrderContext | null,
): boolean {
  if (request.source !== "outside_purchase") return false;
  if (request.status !== "quoted") return true;
  if (orderContext != null) return true;
  return false;
}

export function adminOutsidePurchaseDeleteEligibility(
  request: Pick<
    ItemRequest,
    "status" | "source" | "outsidePurchasePublishedAt"
  >,
  orderContext?: ItemRequestOrderContext | null,
): { allowed: true } | { allowed: false; reason: string } {
  if (request.source !== "outside_purchase") {
    return { allowed: false, reason: "Not an outside-purchase line." };
  }
  if (request.outsidePurchasePublishedAt) {
    return {
      allowed: false,
      reason: "Withdraw this line from the customer before deleting.",
    };
  }
  if (request.status === "withdrawn") {
    return { allowed: false, reason: "Already removed." };
  }
  if (request.status === "approved") {
    return {
      allowed: false,
      reason: "Customer has this in their cart — it must be removed from cart first.",
    };
  }
  if (request.status !== "quoted") {
    return {
      allowed: false,
      reason: "Only quoted outside purchases can be deleted here.",
    };
  }
  if (orderContext) {
    return {
      allowed: false,
      reason: "Cannot delete after checkout has started.",
    };
  }
  return { allowed: true };
}
