/** Timeline-only quote rows (see `item_quotes.checkout_snapshot_kind`). */
export const ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID = "paid" as const;
export const ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE =
  "company_purchase" as const;

export type ItemQuoteCheckoutSnapshotKind =
  | typeof ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID
  | typeof ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE;

/** Timeline copies are excluded from cart / latest operational quote resolution. */
export function isOperationalQuoteRow(q: {
  checkoutSnapshotKind: string | null;
}): boolean {
  const raw = q.checkoutSnapshotKind;
  if (raw == null) return true;
  const k = raw.trim();
  if (k === "") return true;
  if (k === ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID) return false;
  if (k === ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE) return false;
  return true;
}
