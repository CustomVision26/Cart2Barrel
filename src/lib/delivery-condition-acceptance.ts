import type { SQL } from "drizzle-orm";
import { and, eq, inArray, not } from "drizzle-orm";

import type { OrderItem } from "@/db/schema";
import { orderItems } from "@/db/schema";
import { BARREL_PIPELINE_AWAITING_ASSIGNMENT } from "@/lib/barrel-pipeline-fulfillment";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

export const PROBLEM_DELIVERY_RECEIPT_FULFILLMENTS = [
  "delivery_received_item_damaged",
  "delivery_received_wrong_item",
] as const satisfies readonly OrderItem["fulfillmentStatus"][];

export type ProblemDeliveryReceiptFulfillment =
  (typeof PROBLEM_DELIVERY_RECEIPT_FULFILLMENTS)[number];

export function isProblemDeliveryReceiptFulfillment(
  status: OrderItem["fulfillmentStatus"],
): status is ProblemDeliveryReceiptFulfillment {
  return (PROBLEM_DELIVERY_RECEIPT_FULFILLMENTS as readonly string[]).includes(
    status,
  );
}

export function isWarehouseReceiveCondition(
  value: string | null | undefined,
): value is WarehouseReceiveCondition {
  return (
    value === "good" ||
    value === "damaged" ||
    value === "missing" ||
    value === "wrong_item"
  );
}

export function problemDeliveryWarehouseCondition(
  fulfillment: OrderItem["fulfillmentStatus"],
  warehouseReceivedCondition: string | null | undefined,
): WarehouseReceiveCondition | null {
  if (isWarehouseReceiveCondition(warehouseReceivedCondition)) {
    if (
      fulfillment === "delivery_received_item_damaged" &&
      warehouseReceivedCondition === "damaged"
    ) {
      return "damaged";
    }
    if (
      fulfillment === "delivery_received_wrong_item" &&
      warehouseReceivedCondition === "wrong_item"
    ) {
      return "wrong_item";
    }
    if (fulfillment === "delivery_received_item_damaged") {
      return "damaged";
    }
    if (fulfillment === "delivery_received_wrong_item") {
      return "wrong_item";
    }
  }
  if (fulfillment === "delivery_received_item_damaged") return "damaged";
  if (fulfillment === "delivery_received_wrong_item") return "wrong_item";
  return null;
}

export const DELIVERY_CONDITION_ACCEPTED_WAREHOUSE_CONDITIONS = [
  "damaged",
  "wrong_item",
] as const satisfies readonly WarehouseReceiveCondition[];

export function isDeliveryConditionAcceptedForBarrel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"],
  warehouseReceivedCondition: string | null | undefined,
): boolean {
  return (
    fulfillmentStatus === BARREL_PIPELINE_AWAITING_ASSIGNMENT &&
    (warehouseReceivedCondition === "damaged" ||
      warehouseReceivedCondition === "wrong_item")
  );
}

/** Customer-accepted problem receipts still on `delivery_received_good_awaiting_barrel`. */
export function isDeliveryConditionAcceptedAwaitingBarrelSql(): SQL {
  return and(
    eq(orderItems.fulfillmentStatus, BARREL_PIPELINE_AWAITING_ASSIGNMENT),
    inArray(
      orderItems.warehouseReceivedCondition,
      [...DELIVERY_CONDITION_ACCEPTED_WAREHOUSE_CONDITIONS],
    ),
  )!;
}

export function excludeDeliveryConditionAcceptedAwaitingBarrelSql(): SQL {
  return not(isDeliveryConditionAcceptedAwaitingBarrelSql());
}

/** Customer-facing status after accepting a problem receipt for barrel packing. */
export function deliveryConditionAcceptedAwaitingBarrelLabel(
  warehouseReceivedCondition: string | null | undefined,
): string | null {
  if (warehouseReceivedCondition === "damaged") {
    return "Delivery damaged accepted awaiting barrel";
  }
  if (warehouseReceivedCondition === "wrong_item") {
    return "Delivery wrong item accepted awaiting barrel";
  }
  return null;
}

export function problemDeliveryReceiptStatusLabel(
  fulfillment: OrderItem["fulfillmentStatus"],
  warehouseReceivedCondition: string | null | undefined,
): string | null {
  const cond = problemDeliveryWarehouseCondition(
    fulfillment,
    warehouseReceivedCondition,
  );
  if (!cond) return null;
  return `Delivery received: ${warehouseReceiveConditionLabel(cond).toLowerCase()}`;
}
