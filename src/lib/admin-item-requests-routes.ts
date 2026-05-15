/** Deep links under admin Item requests */
export const ADMIN_ITEM_REQUESTS_ROUTES = {
  /** Parent segment; landing redirects to `activeRequestsQueue`. */
  activeRequests: "/admin/item-requests/active-requests",
  activeRequestsQueue: "/admin/item-requests/active-requests/queue",
  /** Single-line quote revisions (sub-tab under Active requests). */
  activeRequestsQuoteHistory:
    "/admin/item-requests/active-requests/quote-history",
  /** Canonical Batch Items landing (sub-tabs live under `/batch-items/...`). */
  batchItems: "/admin/item-requests/batch-items",
  batchItemsSubmitted:
    "/admin/item-requests/batch-items/submitted",
  batchItemsBatchEstimates:
    "/admin/item-requests/batch-items/batch-estimates",
  batchItemsBatchHistory:
    "/admin/item-requests/batch-items/batch-history",
} as const;
