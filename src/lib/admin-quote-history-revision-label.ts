import type { ItemQuote } from "@/db/schema";
import {
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID,
} from "@/lib/checkout-snapshot-kind";
import { ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK } from "@/lib/item-quote-void-reason";

export function quoteRevisionLabel(q: ItemQuote): string {
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID) {
    return "Paid";
  }
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE) {
    return "Company Purchase";
  }
  if (q.voidedAt) {
    if (q.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK) {
      return "Out of stock";
    }
    return "Superseded";
  }
  return "Current";
}
