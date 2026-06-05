export type WarehouseReceiveCondition =
  | "good"
  | "damaged"
  | "missing"
  | "wrong_item";

export const WAREHOUSE_RECEIVE_CONDITION_OPTIONS: {
  value: WarehouseReceiveCondition;
  label: string;
}[] = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
  { value: "wrong_item", label: "Wrong Item" },
];

export function warehouseReceiveConditionLabel(c: WarehouseReceiveCondition): string {
  return (
    WAREHOUSE_RECEIVE_CONDITION_OPTIONS.find((o) => o.value === c)?.label ?? c
  );
}

/**
 * Sub-reason captured when the received condition is `missing`. Distinguishes a
 * package that arrived with nothing inside from one that never reached the hub.
 */
export type WarehouseMissingReason = "package_empty" | "package_not_received";

export const WAREHOUSE_MISSING_REASON_OPTIONS: {
  value: WarehouseMissingReason;
  label: string;
}[] = [
  { value: "package_empty", label: "Package empty" },
  { value: "package_not_received", label: "Package not Received" },
];

export function isWarehouseMissingReason(
  v: string | null | undefined,
): v is WarehouseMissingReason {
  return v === "package_empty" || v === "package_not_received";
}

export function warehouseMissingReasonLabel(
  r: WarehouseMissingReason | null | undefined,
): string | null {
  if (!r) return null;
  return WAREHOUSE_MISSING_REASON_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

/**
 * Customer-facing guidance for a `missing` outside purchase. Because outside
 * purchases are bought and shipped by the customer (not the hub), the customer
 * is the one who can chase the carrier/retailer, so we point them at their own
 * tracking instead of offering a refund/replacement from us.
 */
export function outsidePurchaseMissingReasonInstruction(
  r: WarehouseMissingReason | null | undefined,
): string {
  switch (r) {
    case "package_not_received":
      return "Your package never reached our hub. Please check your carrier tracking — if it shows delivered to our address, contact the carrier to open a claim; if it is still in transit or lost, follow up with the carrier or retailer.";
    case "package_empty":
      return "Your package arrived at our hub but the product was not inside. Please check your tracking and order confirmation, then contact the retailer or carrier about the empty/short shipment so they can investigate.";
    default:
      return "Please check your carrier tracking and order details. If the package was not received or arrived empty, contact the carrier or retailer to open a claim.";
  }
}
