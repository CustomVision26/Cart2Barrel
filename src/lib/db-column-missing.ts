/** Postgres undefined_column */
const PG_UNDEFINED_COLUMN = "42703";

function errorChain(e: unknown): unknown[] {
  const out: unknown[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    if (typeof cur === "object" && cur !== null && "cause" in cur) {
      cur = (cur as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return out;
}

function chainMessage(e: unknown): string {
  return errorChain(e)
    .map((x) => (x instanceof Error ? x.message : String(x)))
    .join(" ");
}

export function getPgErrorCode(e: unknown): string | undefined {
  for (const link of errorChain(e)) {
    if (typeof link === "object" && link !== null && "code" in link) {
      const c = (link as { code: unknown }).code;
      if (typeof c === "string" && c.length > 0) return c;
    }
  }
  return undefined;
}

export function combinedErrorText(e: unknown): string {
  return chainMessage(e);
}

/** DB enum missing `delivery_received_*` values until migration `0024_order_item_delivery_received_fulfillment` (or `npm run db:push`). */
export function isInvalidOrderItemFulfillmentStatusEnumError(e: unknown): boolean {
  const low = `${combinedErrorText(e)}\n${String(e)}`.toLowerCase();

  if (
    low.includes("delivery_received_good_awaiting_barrel") ||
    low.includes("delivery_received_item_missing") ||
    low.includes("delivery_received_item_damaged") ||
    low.includes("delivery_received_wrong_item") ||
    low.includes("product_return_awaiting_delivery")
  ) {
    if (
      /failed query/i.test(low) ||
      /invalid input value for enum/i.test(low) ||
      /\b22p02\b/.test(low)
    ) {
      return true;
    }
  }

  if (getPgErrorCode(e) === "22P02") {
    if (
      low.includes("order_item_fulfillment") ||
      low.includes("fulfillment_status") ||
      low.includes("delivery_received") ||
      low.includes("product_return")
    ) {
      return true;
    }
  }
  if (
    /failed query/i.test(low) &&
    low.includes('update "order_items"') &&
    low.includes("fulfillment_status") &&
    (low.includes("delivery_received") || getPgErrorCode(e) === "22P02")
  ) {
    return true;
  }
  if (!/invalid input value for enum/i.test(low)) return false;
  return (
    low.includes("order_item_fulfillment") ||
    (low.includes("fulfillment") &&
      (low.includes("delivery_received") || low.includes("product_return")))
  );
}

/**
 * Query failed likely because `order_items.fulfillment_status` used an enum value not present
 * in the database yet (migrations lag). Handles Neon "Failed query" wrappers.
 */
export function isLikelyOrderFulfillmentEnumInQueryFailure(e: unknown): boolean {
  if (isInvalidOrderItemFulfillmentStatusEnumError(e)) return true;
  const low = `${combinedErrorText(e)}\n${String(e)}`.toLowerCase();
  if (getPgErrorCode(e) === "22P02") return true;
  if (/invalid input value for enum/i.test(low)) return true;
  if (
    /failed query/i.test(low) &&
    low.includes("count(distinct") &&
    low.includes("orders") &&
    low.includes("order_items") &&
    low.includes("fulfillment_status")
  ) {
    return true;
  }
  return false;
}

/**
 * True when the failure is almost certainly a missing DB column (migrations not applied).
 * Drizzle/Neon may wrap the driver error; we inspect the full cause chain.
 */
export function isUndefinedColumnError(e: unknown, columnHint: string): boolean {
  const hint = columnHint.toLowerCase();
  const combined = chainMessage(e).toLowerCase();
  if (!combined.includes(hint)) return false;

  for (const link of errorChain(e)) {
    if (typeof link === "object" && link !== null && "code" in link) {
      if (String((link as { code: unknown }).code) === PG_UNDEFINED_COLUMN) {
        return true;
      }
    }
  }

  return (
    /does not exist/i.test(combined) ||
    /undefined column/i.test(combined) ||
    /\b42703\b/.test(combined)
  );
}

/** `item_requests.batch_quote_session_id` is missing until batch-quote migration applies. */
export function isMissingBatchQuoteSessionIdColumnError(e: unknown): boolean {
  return isUndefinedColumnError(e, "batch_quote_session_id");
}

/** `item_requests.outside_purchase_published_at` — migration `0069_outside_purchase_published_at` or `npm run db:push`. */
export function isMissingOutsidePurchasePublishedAtColumnError(
  e: unknown,
): boolean {
  return isUndefinedColumnError(e, "outside_purchase_published_at");
}

/**
 * `0044_outside_purchase_receipt_image` / `0066_outside_purchase_condition_image`
 * (or `npm run db:push`). Both columns are dropped together in the select fallback,
 * so either missing column routes through the same recovery path.
 */
export function isMissingOutsidePurchaseReceiptImageUrlColumnError(
  e: unknown,
): boolean {
  return (
    isUndefinedColumnError(e, "outside_purchase_receipt_image_url") ||
    isUndefinedColumnError(e, "outside_purchase_condition_image_url") ||
    isUndefinedColumnError(e, "outside_purchase_missing_reason") ||
    isUndefinedColumnError(e, "outside_purchase_missing_resolved_at")
  );
}

/** `item_requests.outside_purchase_condition_image_urls` — migration `0072_outside_purchase_condition_image_urls` or `npm run db:push`. */
export function isMissingOutsidePurchaseConditionImageUrlsColumnError(
  e: unknown,
): boolean {
  return isUndefinedColumnError(e, "outside_purchase_condition_image_urls");
}

/** `item_requests.outside_purchase_condition_image_url` — migration `0066_outside_purchase_condition_image` or `npm run db:push`. */
export function isMissingOutsidePurchaseConditionImageUrlColumnError(
  e: unknown,
): boolean {
  return isUndefinedColumnError(e, "outside_purchase_condition_image_url");
}

/** `item_quotes.merchandise_savings_cents` is missing until that migration applies. */
export function isMissingMerchandiseSavingsColumnError(e: unknown): boolean {
  return isUndefinedColumnError(e, "merchandise_savings_cents");
}

/** `outside_purchase_return_requests` — migration `0047_outside_purchase_return_requests` or `npm run db:push`. */
export function isMissingOutsidePurchaseReturnRequestsTableError(
  e: unknown,
): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  if (!msg.includes("outside_purchase_return_requests")) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** `order_item_product_return_requests` — migration `0050_order_item_product_return_requests` or `npm run db:push`. */
export function isMissingOrderItemProductReturnRequestsTableError(
  e: unknown,
): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  if (!msg.includes("order_item_product_return_requests")) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** `desired_outcome` on return requests — migration `0051_product_return_desired_outcome` or `npm run db:push`. */
export function isMissingProductReturnDesiredOutcomeColumnError(
  e: unknown,
): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  if (!msg.includes("desired_outcome")) return false;
  if (!msg.includes("order_item_product_return_requests")) return false;
  const code = getPgErrorCode(e);
  if (code === "42703") return true;
  return /column\b.*does not exist|undefined column/i.test(msg);
}

/** Batch quote tables absent until migration applies. */
export function isMissingBatchQuoteTablesRelationError(e: unknown): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  const hints = [
    "batch_quote_sessions",
    "batch_quote_session_lines",
    "batch_quote_estimates",
  ];
  if (!hints.some((h) => msg.includes(h))) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** Retailer tracking pair on `order_items`; apply `0021_order_item_retailer_tracking_pair` or `npm run db:push`. */
export function isMissingCompanyPurchaseRetailerTrackingColumnsError(
  e: unknown,
): boolean {
  return (
    isUndefinedColumnError(e, "company_purchase_retailer_tracking_company") ||
    isUndefinedColumnError(e, "company_purchase_retailer_tracking_number")
  );
}

/** Warehouse receipt columns on `order_items`; apply `0023_order_items_warehouse_receipt` or `npm run db:push`. */
export function isMissingOrderItemWarehouseReceiptColumnsError(
  e: unknown,
): boolean {
  return (
    isUndefinedColumnError(e, "warehouse_received_at") ||
    isUndefinedColumnError(e, "warehouse_received_proof_photo_urls") ||
    isUndefinedColumnError(e, "warehouse_received_missing_reason")
  );
}

/** Admin updated-by columns on `order_items`; apply `0063_admin_recorded_by_clerk_user_id` or `npm run db:push`. */
export function isMissingOrderItemAdminUpdatedByColumnsError(
  e: unknown,
): boolean {
  return (
    isUndefinedColumnError(e, "warehouse_received_by_clerk_user_id") ||
    isUndefinedColumnError(e, "company_purchase_updated_by_clerk_user_id")
  );
}

/** `batch_quote_sessions.cart_acceptance_*` — apply migration 0016_batch_cart_acceptance or run `npm run db:push`. */
export function isMissingBatchCartAcceptanceColumnsError(e: unknown): boolean {
  return (
    isUndefinedColumnError(e, "cart_acceptance_accepted_at") ||
    isUndefinedColumnError(e, "cart_acceptance_accepted_estimate_id")
  );
}

/** DB enum missing cart/checkout values until migration `0017_batch_quote_session_status_cart_flow` or `npm run db:push`. */
export function isInvalidBatchQuoteSessionStatusEnumError(e: unknown): boolean {
  const low = combinedErrorText(e).toLowerCase();
  if (!low.includes("batch_quote_session_status")) return false;
  if (/invalid input value for enum/i.test(low)) return true;
  return getPgErrorCode(e) === "22P02";
}

export function shouldUseBatchQuoteSchemaFallback(e: unknown): boolean {
  return (
    isMissingBatchQuoteSessionIdColumnError(e) ||
    isMissingBatchQuoteTablesRelationError(e) ||
    isMissingBatchCartAcceptanceColumnsError(e) ||
    isInvalidBatchQuoteSessionStatusEnumError(e)
  );
}

/**
 * Lifecycle audit writes can fail until `npm run db:push` (or Neon SQL) aligns the
 * `batch_quote_session_status_events` table and `batch_quote_session_status_event_kind` enum.
 * Skipping the insert keeps cart/checkout flows usable; data still updates on `batch_quote_sessions`.
 */
export function shouldBestEffortSkipBatchQuoteSessionStatusEventWrite(
  e: unknown,
): boolean {
  const code = getPgErrorCode(e);
  if (code === "23503" || code === "23505") return false;

  const low = `${combinedErrorText(e)}\n${String(e)}`.toLowerCase();

  const mentionsAuditTable =
    low.includes('"batch_quote_session_status_events"') ||
    low.includes("batch_quote_session_status_events");
  const mentionsAuditEnum = low.includes("batch_quote_session_status_event_kind");

  if (!mentionsAuditTable && !mentionsAuditEnum) return false;

  if (/foreign key constraint/i.test(low) || /violates foreign key/i.test(low)) {
    return false;
  }

  if (
    mentionsAuditEnum &&
    /invalid input value for enum/i.test(low)
  ) {
    return true;
  }

  /** Drizzle/driver often exposes `42P01` on the error object, not inside the message. */
  if (mentionsAuditTable && code === "42P01") return true;

  if (mentionsAuditTable && code === PG_UNDEFINED_COLUMN) return true;

  if (mentionsAuditTable && /\b42p01\b/.test(low)) return true;

  if (mentionsAuditTable && /does not exist/.test(low) && low.includes("relation")) {
    return true;
  }

  if (/failed query/i.test(low) && mentionsAuditTable) {
    return true;
  }

  return false;
}

/** `barrel_shipping_intakes` — migration `0055_barrel_shipping_intakes` or `npm run db:push`. */
export function isMissingBarrelShippingIntakesTableError(e: unknown): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  if (!msg.includes("barrel_shipping_intakes")) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** Outbound shipping charge tables until `npm run db:push`. */
export function isMissingBarrelOutboundShippingChargesTableError(e: unknown): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  const mentions =
    msg.includes("barrel_outbound_shipping_charges") ||
    msg.includes("barrel_outbound_shipping_charge_lines") ||
    msg.includes("user_outbound_shipping_cart_lines");
  if (!mentions) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** Missing container catalog tables until migration `0028_container_offerings_cart` or `npm run db:push`. */
export function isMissingContainerCatalogSchemaError(e: unknown): boolean {
  const code = getPgErrorCode(e);
  const low = `${combinedErrorText(e)}\n${String(e)}`.toLowerCase();
  const mentions =
    low.includes("container_offerings") ||
    low.includes("container_offering_images") ||
    low.includes("user_container_cart_lines") ||
    low.includes("order_container_items");
  if (!mentions) return false;
  if (code === "42P01") return true;
  if (/does not exist/.test(low) && /relation/.test(low)) return true;
  if (/failed query/i.test(low)) return true;
  return false;
}

/** DB enum missing `out_of_stock` until migration `0041_item_request_out_of_stock` or `npm run db:push`. */
export function isMissingItemRequestOutOfStockStatusError(e: unknown): boolean {
  const low = `${combinedErrorText(e)}\n${String(e)}`.toLowerCase();
  if (!low.includes("out_of_stock") && !low.includes("item_request_status")) {
    return false;
  }
  if (/invalid input value for enum/i.test(low)) return true;
  if (getPgErrorCode(e) === "22P02") return true;
  if (/failed query/i.test(low) && low.includes("item_requests")) return true;
  return false;
}

/** Admin notification feed tables until `npm run db:push` or `npm run db:ensure-admin-activity`. */
export function isMissingAdminUserActivityTablesError(e: unknown): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  const mentions =
    msg.includes("admin_user_activity_events") ||
    msg.includes("admin_user_activity_event_reads") ||
    msg.includes("admin_user_activity_event_kind");
  if (!mentions) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}

/** User status-update feed tables until `npm run db:push` or `npm run db:ensure-user-status-updates`. */
export function isMissingUserStatusUpdateTablesError(e: unknown): boolean {
  const msg = combinedErrorText(e).toLowerCase();
  const mentions =
    msg.includes("user_status_update_events") ||
    msg.includes("user_status_update_event_reads") ||
    msg.includes("user_status_update_kind");
  if (!mentions) return false;
  const code = getPgErrorCode(e);
  if (code === "42P01") return true;
  return /does not exist|relation\b/i.test(msg);
}
