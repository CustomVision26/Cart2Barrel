import type { ItemRequest } from "@/db/schema";
import {
  isMissingBatchQuoteSessionIdColumnError,
  isMissingOutsidePurchaseReceiptImageUrlColumnError,
} from "@/lib/db-column-missing";

import {
  itemRequestFromRowWithoutReceiptImage,
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  itemRequestsRowSelectWithoutReceiptImage,
  withLegacyItemRequestDefaults,
} from "@/data/item-requests";

type LegacyRow = Parameters<typeof withLegacyItemRequestDefaults>[0];

/** Run a Drizzle select; recover when optional `item_requests` columns are not migrated yet. */
export async function runItemRequestSelectWithFallback<T>(handlers: {
  full: () => Promise<T>;
  withoutReceiptImage: () => Promise<T>;
  legacy: () => Promise<T>;
  legacyWithoutReceiptImage: () => Promise<T>;
}): Promise<T> {
  try {
    return await handlers.full();
  } catch (e) {
    if (isMissingOutsidePurchaseReceiptImageUrlColumnError(e)) {
      return handlers.withoutReceiptImage();
    }
    if (isMissingBatchQuoteSessionIdColumnError(e)) {
      try {
        return await handlers.legacy();
      } catch (legacyErr) {
        if (isMissingOutsidePurchaseReceiptImageUrlColumnError(legacyErr)) {
          return handlers.legacyWithoutReceiptImage();
        }
        throw legacyErr;
      }
    }
    throw e;
  }
}

export function mapLegacyItemRequestRow(row: LegacyRow): ItemRequest {
  return withLegacyItemRequestDefaults(row);
}

export function mapItemRequestRowWithoutReceiptImage(
  row: Parameters<typeof itemRequestFromRowWithoutReceiptImage>[0],
): ItemRequest {
  return itemRequestFromRowWithoutReceiptImage(row);
}

export {
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  itemRequestsRowSelectWithoutReceiptImage,
};
