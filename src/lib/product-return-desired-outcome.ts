import { z } from "zod";

import type { OrderItem } from "@/db/schema";

export const productReturnDesiredOutcomeValues = [
  "money_back",
  "replacement",
] as const;

export const productReturnDesiredOutcomeSchema = z.enum(
  productReturnDesiredOutcomeValues,
);

export type ProductReturnDesiredOutcome = z.infer<
  typeof productReturnDesiredOutcomeSchema
>;

/** UI copy variant for product-return outcome radios and summaries. */
export type ProductReturnDesiredOutcomeContext =
  | "default"
  | "delivery_item_missing"
  | "hub_stock_us";

export function productReturnDesiredOutcomeContextFromFulfillment(
  fulfillment: OrderItem["fulfillmentStatus"],
): ProductReturnDesiredOutcomeContext {
  return fulfillment === "delivery_received_item_missing" ?
      "delivery_item_missing"
    : fulfillment === "hub_stock_us_delivered" ||
        fulfillment === "hub_stock_return_requested" ?
      "hub_stock_us"
    : "default";
}

/** Resolves outcome copy from line state (current or held fulfillment / warehouse condition). */
export function resolveProductReturnDesiredOutcomeContext(input: {
  fulfillmentStatus?: OrderItem["fulfillmentStatus"];
  heldFulfillmentStatus?: OrderItem["fulfillmentStatus"] | null;
  warehouseReceivedCondition?: string | null;
}): ProductReturnDesiredOutcomeContext {
  if (
    input.fulfillmentStatus === "delivery_received_item_missing" ||
    input.heldFulfillmentStatus === "delivery_received_item_missing" ||
    input.warehouseReceivedCondition === "missing"
  ) {
    return "delivery_item_missing";
  }
  if (
    input.fulfillmentStatus === "hub_stock_us_delivered" ||
    input.fulfillmentStatus === "hub_stock_return_requested" ||
    input.heldFulfillmentStatus === "hub_stock_us_delivered"
  ) {
    return "hub_stock_us";
  }
  return "default";
}

export function productReturnDesiredOutcomeLabel(
  outcome: ProductReturnDesiredOutcome,
  context: ProductReturnDesiredOutcomeContext = "default",
): string {
  if (context === "delivery_item_missing") {
    switch (outcome) {
      case "money_back":
        return "Request a replacement from the retailer";
      case "replacement":
        return "Request a refund from the retailer";
    }
  }

  switch (outcome) {
    case "money_back":
      return "Refund";
    case "replacement":
      return "Replacement product";
  }
}

export function productReturnDesiredOutcomeShortLabel(
  outcome: ProductReturnDesiredOutcome,
  context: ProductReturnDesiredOutcomeContext = "default",
): string {
  if (context === "delivery_item_missing") {
    switch (outcome) {
      case "money_back":
        return "Request replacement";
      case "replacement":
        return "Request refund";
    }
  }

  switch (outcome) {
    case "money_back":
      return "Money back";
    case "replacement":
      return "Replacement product";
  }
}

export function productReturnDesiredOutcomeDescription(
  outcome: ProductReturnDesiredOutcome,
  context: ProductReturnDesiredOutcomeContext = "default",
): string {
  if (context === "delivery_item_missing") {
    switch (outcome) {
      case "money_back":
        return "Our team will contact the retailer, report the missing item, and request a replacement shipment. Additional service or shipping charges may apply.";
      case "replacement":
        return "Our team will contact the retailer, report the missing item, and request a refund for this line. Additional service or shipping charges may apply.";
    }
  }

  if (context === "hub_stock_us") {
    switch (outcome) {
      case "money_back":
        return "Staff will generate a return shipping label to the warehouse. Print it from Orders, drop the package at a carrier location, and this line is refunded after the warehouse receives it. Return shipping may be deducted.";
      case "replacement":
        return "Staff will generate a return shipping label to the warehouse. Print it from Orders and drop the package at a carrier location. After it arrives, we ship a replacement from hub stock. Additional shipping may apply.";
    }
  }

  switch (outcome) {
    case "money_back":
      return "Our team will return the item to the retailer. If the return is accepted, you will receive a refund for this line. Additional service or shipping charges may apply.";
    case "replacement":
      return "Our team will return the item and arrange a replacement of the same or an equivalent product. Additional service, shipping, or price-difference charges may apply.";
  }
}

export function productReturnDesiredOutcomeFieldLegend(
  context: ProductReturnDesiredOutcomeContext = "default",
): string {
  return context === "delivery_item_missing" ?
      "Preferred retailer resolution"
    : "Preferred outcome";
}

export function productReturnDesiredOutcomeFieldIntro(
  context: ProductReturnDesiredOutcomeContext = "default",
): string {
  if (context === "delivery_item_missing") {
    return "This item was marked missing at delivery. Select how our team should communicate with the retailer on your behalf.";
  }
  if (context === "hub_stock_us") {
    return "You will print a Shippo return label and drop the package at a carrier location. Select the outcome you prefer after the warehouse receives it.";
  }
  return "Our team will manage the physical return and shipping. Select the outcome you prefer below.";
}
