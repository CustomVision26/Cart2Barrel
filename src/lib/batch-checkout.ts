import type { BatchQuoteSession } from "@/db/schema";

type BatchCheckoutSessionFields = Pick<
  BatchQuoteSession,
  "cartAcceptanceAcceptedAt" | "status"
>;

/** Session accepted into cart checkout or already paid as a batch bundle. */
export function isBatchCheckoutSession(session: BatchCheckoutSessionFields): boolean {
  return (
    session.cartAcceptanceAcceptedAt != null ||
    session.status === "in_cart" ||
    session.status === "paid_pending_staff_purchase"
  );
}

export function isBatchCheckoutBundle(
  bundle: { session: BatchCheckoutSessionFields } | undefined,
): boolean {
  return bundle != null && isBatchCheckoutSession(bundle.session);
}

const BATCH_CHECKOUT_SNAPSHOT_PHASES = new Set([
  "checkout_paid_pending_delivery",
  "company_purchase_pending_delivery",
  "warehouse_delivery_received",
  "warehouse_delivery_received_prior",
  "product_return_requested",
  "product_return_tracking_saved",
  "customer_refund_request_submitted",
]);

/** Product line snapshots indicating checkout happened inside a batch bundle. */
export function isProductBatchCheckoutFromSnapshots(
  snapshots: { phase: string; batchQuoteSessionId: string | null }[],
): boolean {
  return snapshots.some(
    (snapshot) =>
      Boolean(snapshot.batchQuoteSessionId?.trim()) &&
      BATCH_CHECKOUT_SNAPSHOT_PHASES.has(snapshot.phase),
  );
}

/** Product line snapshots linked to a batch quote session (submitted bundle or later). */
export function isProductBatchBundleFromSnapshots(
  snapshots: { batchQuoteSessionId: string | null }[],
): boolean {
  return snapshots.some((snapshot) =>
    Boolean(snapshot.batchQuoteSessionId?.trim()),
  );
}
