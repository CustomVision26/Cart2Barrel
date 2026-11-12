import type {
  ItemQuote,
  ItemRequest,
  ShoppingListQuote,
  ShoppingListQuoteLine,
} from "@/db/schema";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import { STARTER_BUNDLE_SITE_NAME } from "@/lib/starter-bundles";

export const SHOPPING_LIST_SITE_KEY = "shopping-list" as const;
export const SHOPPING_LIST_SITE_NAME = "Shopping list" as const;
export const SHOPPING_LIST_MAX_LINES = 40;
export const SHOPPING_LIST_QUOTE_STATUSES = [
  "draft",
  "submitted",
  "estimated",
] as const;

export type ShoppingListQuoteStatus =
  (typeof SHOPPING_LIST_QUOTE_STATUSES)[number];

/** Staff-only progress on a list quote. It is not sent to the shopper. */
export type ShoppingListStaffDraft = {
  savedAt: string;
  staffNote: string | null;
  lines: {
    itemRequestId: string;
    productName: string | null;
    quantity: number;
    productSize: string | null;
    productColor: string | null;
    note: string | null;
    productImageUrl: string | null;
    itemCostCents: number;
    serviceFeeCents: number;
    estimatedShippingCents: number;
    taxCents: number;
  }[];
};

export function isShoppingListQuoteStatus(
  value: string | null | undefined,
): value is ShoppingListQuoteStatus {
  return (
    value === "draft" || value === "submitted" || value === "estimated"
  );
}

export function isShoppingListSiteKey(
  value: string | null | undefined,
): boolean {
  return value === SHOPPING_LIST_SITE_KEY;
}

export function isShoppingListItemRequest(request: {
  siteName?: string | null;
  productUrl?: string | null;
}): boolean {
  if (request.siteName === SHOPPING_LIST_SITE_NAME) return true;
  if (request.siteName === STARTER_BUNDLE_SITE_NAME) return true;
  const url = request.productUrl?.trim() ?? "";
  return url.includes("/shopping-list/") || url.includes("/starter-bundle/");
}

export function adminListQuotesHref(opts?: { batchSessionId?: string }): string {
  const params = new URLSearchParams({ tab: "list-quotes" });
  if (opts?.batchSessionId) params.set("batch", opts.batchSessionId);
  return `/admin/overview?${params.toString()}`;
}

export const SHOPPING_LIST_PERSONAL_QUOTE_BLOCKED_MESSAGE =
  "Shopping-list products are priced on Overview → List quotes, not as individual estimates.";

export function shoppingListItemProductUrl(
  listId: string,
  lineId: string,
): string {
  return `https://amanicart2-barrel.app/shopping-list/${listId}/line/${lineId}`;
}

export function shoppingListLineTaxCents(quote: ItemQuote | null): number {
  if (!quote) return 0;
  return lineSaleTaxCentsFromQuote(quote);
}

export type AdminShoppingListQuoteLineView = {
  line: ShoppingListQuoteLine;
  request: ItemRequest;
  quote: ItemQuote | null;
};

export type AdminShoppingListQuoteView = {
  list: ShoppingListQuote;
  customerFullName: string | null;
  customerEmail: string | null;
  batchNumber: string | null;
  /** When the shopper's batch session was submitted. */
  batchSubmittedAt: string | null;
  lines: AdminShoppingListQuoteLineView[];
};
