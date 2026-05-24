import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

/** Shown when staff has not published return service & handling fee yet. */
export const OUTSIDE_PURCHASE_RETURN_ESTIMATE_PENDING_NOTE =
  "Staff has not published a return estimate yet.";

/** Default staff note when publishing a return estimate from the admin queue. */
export const OUTSIDE_PURCHASE_RETURN_ESTIMATE_DEFAULT_STAFF_NOTE =
  "Returned fee must be paid before items can be drop off to shipping company. Fee includes Transit fee + service and handling fee";

/** Return charges and policies (Preview return dialog). */
export const OUTSIDE_PURCHASE_RETURN_POLICY_NOTES: readonly string[] = [
  "Return service and handling charges must be paid before the product can be dropped off at the shipping company.",
  "You will receive a staff estimate for the return workflow. Accept the estimate and pay before scheduling drop-off date to shipping company.",
  "The original outside purchase service and handling fee must be paid before product(s) can be added into your barrel.",
  "Unpaid outside purchases marked Damaged/Missing/Wrong item may be discarded if no action is taken to pay the outside purchase service and handling fee or return to retailer or return to you the customer.",
] as const;

/** @deprecated Use {@link OUTSIDE_PURCHASE_RETURN_POLICY_NOTES}. */
export function outsidePurchaseReturnPreviewDisclaimers(
  _condition: WarehouseReceiveCondition | null,
): string[] {
  return [...OUTSIDE_PURCHASE_RETURN_POLICY_NOTES];
}

export function outsidePurchaseReturnPreviewTitle(
  condition: WarehouseReceiveCondition | null,
): string {
  const label = condition ? warehouseReceiveConditionLabel(condition) : "Problem receipt";
  return `Return to retailer · ${label}`;
}
