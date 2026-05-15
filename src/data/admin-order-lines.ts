import type { User } from "@clerk/nextjs/server";

import type { PaidOrdersQueryInput } from "@/lib/paid-orders-list-params";
import { isClerkAdmin } from "@/lib/is-clerk-admin";

import type { PaidOrderLineListRow, PaidOrderLinesPageResult } from "@/data/paid-orders-queries";
import { listPaidOrderLinesPage } from "@/data/paid-orders-queries";
import { DELIVERY_RECEIVED_FULFILLMENT_STATUSES } from "@/lib/warehouse-receipt-queue";

export type AdminPaidOrderLineRow = PaidOrderLineListRow;

export type AdminPaidOrderLinesPageResult = PaidOrderLinesPageResult;

/** @deprecated Use `PaidOrdersQueryInput` from `@/lib/paid-orders-list-params`. */
export type AdminOrdersQueryPack = PaidOrdersQueryInput;

export async function listAdminPaidOrderLinesPage(
  clerkUser: User | null,
  queryInput: PaidOrdersQueryInput,
): Promise<PaidOrderLinesPageResult> {
  if (!isClerkAdmin(clerkUser)) {
    return {
      rows: [],
      totalOrders: 0,
      page: 1,
      pageSize: queryInput.ps,
      totalPages: 1,
      query: queryInput,
    };
  }
  return listPaidOrderLinesPage({
    scope: "allPaidOrders",
    query: queryInput,
    lineFulfillmentExclude: [
      "company_purchase_pending_delivery",
      ...DELIVERY_RECEIVED_FULFILLMENT_STATUSES,
    ],
  });
}

export async function listAdminPaidOrderHistoryLinesPage(
  clerkUser: User | null,
  queryInput: PaidOrdersQueryInput,
): Promise<PaidOrderLinesPageResult> {
  if (!isClerkAdmin(clerkUser)) {
    return {
      rows: [],
      totalOrders: 0,
      page: 1,
      pageSize: queryInput.ps,
      totalPages: 1,
      query: queryInput,
    };
  }
  return listPaidOrderLinesPage({
    scope: "allPaidOrders",
    query: queryInput,
  });
}
