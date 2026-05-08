/** Why a quote row was voided (superseded). */
export const ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION = "customer_revision" as const;
export const ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT = "staff_replacement" as const;

export type ItemQuoteVoidReason =
  | typeof ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION
  | typeof ITEM_QUOTE_VOID_REASON_STAFF_REPLACEMENT;
