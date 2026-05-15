import type { ItemQuote } from "@/db/schema";

/** Tax stored implicitly as remainder of total minus itemized line components (see quote preview UI). */
export function lineSaleTaxCentsFromQuote(q: Pick<ItemQuote, "totalPrice" | "itemCost" | "serviceFee" | "estimatedShipping">): number {
  return Math.max(
    0,
    q.totalPrice - q.itemCost - q.serviceFee - q.estimatedShipping
  );
}
