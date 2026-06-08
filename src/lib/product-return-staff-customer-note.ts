import type { ProductReturnDesiredOutcome } from "@/lib/product-return-desired-outcome";

/** Default staff message shown to the customer when return tracking is saved. */
export function defaultProductReturnStaffCustomerNote(
  outcome: ProductReturnDesiredOutcome | null | undefined,
): string {
  if (outcome === "replacement") {
    return "The product has been shipped to the retailer. We will update you after the retailer receives and confirms the return, then coordinate any replacement per your request.";
  }
  return "The product has been shipped to the retailer. Your refund will be issued after the retailer receives and confirms the return.";
}
