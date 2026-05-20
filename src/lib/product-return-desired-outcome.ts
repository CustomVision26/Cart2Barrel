import { z } from "zod";

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

export function productReturnDesiredOutcomeLabel(
  outcome: ProductReturnDesiredOutcome,
): string {
  switch (outcome) {
    case "money_back":
      return "Return product · get money back";
    case "replacement":
      return "Return product · get replacement product";
  }
}

export function productReturnDesiredOutcomeShortLabel(
  outcome: ProductReturnDesiredOutcome,
): string {
  switch (outcome) {
    case "money_back":
      return "Money back";
    case "replacement":
      return "Replacement product";
  }
}

export function productReturnDesiredOutcomeDescription(
  outcome: ProductReturnDesiredOutcome,
): string {
  switch (outcome) {
    case "money_back":
      return "Staff return the item to the retailer; if the return is accepted, you receive a refund for this line. Additional service or shipping charges may or may not apply.";
    case "replacement":
      return "Staff return the item and arrange a replacement (same or equivalent product). Additional service, shipping, or price-difference charges may or may not apply.";
  }
}
