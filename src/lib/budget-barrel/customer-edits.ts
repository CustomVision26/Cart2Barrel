import type { BudgetBarrelOffer } from "@/lib/budget-barrel/types";

export type CustomerProductEdit = {
  productName: string;
  size: string;
  color: string;
  priceCents: number;
};

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/** Keep a shopper's name, size, color, and price when they differ from the stored offer. */
export function applyCustomerProductEdits(
  original: BudgetBarrelOffer,
  current: BudgetBarrelOffer,
  edit: CustomerProductEdit,
): BudgetBarrelOffer {
  const productName = edit.productName.trim();
  const size = blankToNull(edit.size);
  const color = blankToNull(edit.color);
  const changed =
    productName.length > 0 &&
    (productName !== original.productName ||
      size !== blankToNull(original.size) ||
      color !== blankToNull(original.color) ||
      edit.priceCents !== original.priceCents);
  if (!changed) return current;
  return {
    ...current,
    productName,
    size,
    color,
    priceCents: edit.priceCents,
    currency: "USD",
    needsStaffReview: true,
    reviewReason:
      "Customer updated the product name, size, color, or price. Confirm the listing before quoting.",
  };
}
