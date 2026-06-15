import type { OrderItem } from "@/db/schema";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

export function fulfillmentStatusFromWarehouseReceiveCondition(
  condition: WarehouseReceiveCondition,
): Extract<
  OrderItem["fulfillmentStatus"],
  | "delivery_received_good_awaiting_barrel"
  | "delivery_received_item_missing"
  | "delivery_received_item_damaged"
  | "delivery_received_wrong_item"
> {
  switch (condition) {
    case "good":
      return "delivery_received_good_awaiting_barrel";
    case "missing":
      return "delivery_received_item_missing";
    case "damaged":
      return "delivery_received_item_damaged";
    case "wrong_item":
      return "delivery_received_wrong_item";
    default: {
      const _exhaustive: never = condition;
      return _exhaustive;
    }
  }
}

/** Store pickup intake: good items skip awaiting-barrel and enter the in-container pipeline. */
export function fulfillmentStatusAfterStorePickupIntake(
  condition: WarehouseReceiveCondition,
): OrderItem["fulfillmentStatus"] {
  if (condition === "good") {
    return "in_barrel_awaiting_shipping";
  }
  return fulfillmentStatusFromWarehouseReceiveCondition(condition);
}
