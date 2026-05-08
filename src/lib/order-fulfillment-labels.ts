import type { OrderItem } from "@/db/schema";

export function dashboardOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"]
): string {
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Paid: Pending Company Purchase";
    case "company_purchase_pending_delivery":
      return "Company Purchase: Pending Delivery";
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Awaiting payment";
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}

export function adminOrderLineStatusLabel(
  fulfillmentStatus: OrderItem["fulfillmentStatus"]
): string {
  switch (fulfillmentStatus) {
    case "paid_pending_company_purchase":
      return "Paid";
    case "company_purchase_pending_delivery":
      return "Company Purchase: pending delivery";
    case "refunded":
      return "Refunded";
    case "pending_payment":
      return "Pending payment";
    default: {
      const _exhaustive: never = fulfillmentStatus;
      return _exhaustive;
    }
  }
}
