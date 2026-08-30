import type { ProductReturnDesiredOutcome } from "@/lib/product-return-desired-outcome";

/** Default staff message shown to the customer when return tracking is saved. */
export function defaultProductReturnStaffCustomerNote(
  outcome: ProductReturnDesiredOutcome | null | undefined,
  context: "retailer" | "hub_stock_us" = "retailer",
): string {
  if (context === "hub_stock_us") {
    if (outcome === "replacement") {
      return "Print the return shipping label from your order and drop the package at a carrier location. After the warehouse receives it, we will ship a replacement from hub stock.";
    }
    return "Print the return shipping label from your order and drop the package at a carrier location. Your refund will be issued after the warehouse receives the return.";
  }
  if (outcome === "replacement") {
    return "The product has been shipped to the retailer. We will update you after the retailer receives and confirms the return, then coordinate any replacement per your request.";
  }
  return "The product has been shipped to the retailer. Your refund will be issued after the retailer receives and confirms the return.";
}
