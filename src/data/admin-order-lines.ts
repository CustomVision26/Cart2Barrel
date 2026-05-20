import type { User } from "@clerk/nextjs/server";

import type { AdminListQuery } from "@/lib/admin-customer-filter";
import { resolveAdminPaidOrdersScope } from "@/lib/admin-customer-filter";
import type { PaidOrdersQueryInput } from "@/lib/paid-orders-list-params";
import { isClerkAdmin } from "@/lib/is-clerk-admin";

import { backfillOutsidePurchasePaidServiceFeeFulfillment } from "@/data/backfill-outside-purchase-paid-fulfillment";
import type { PaidOrderLineListRow, PaidOrderLinesPageResult } from "@/data/paid-orders-queries";
import { listPaidOrderLinesPage } from "@/data/paid-orders-queries";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { isAdminPurchaseOrdersQueueFulfillment } from "@/lib/warehouse-receipt-queue";

export type AdminPaidOrderLineRow = PaidOrderLineListRow;

export type AdminPaidOrderLinesPageResult = PaidOrderLinesPageResult;

/** @deprecated Use `PaidOrdersQueryInput` from `@/lib/paid-orders-list-params`. */
export type AdminOrdersQueryPack = PaidOrdersQueryInput;

export async function listAdminPaidOrderLinesPage(
  clerkUser: User | null,
  queryInput: AdminListQuery,
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
  await backfillOutsidePurchasePaidServiceFeeFulfillment();
  const pack = await listPaidOrderLinesPage({
    scope: resolveAdminPaidOrdersScope(queryInput.userId),
    query: queryInput,
    adminOrdersQueue: true,
    expandFullOrderLines: true,
  });
  return {
    ...pack,
    rows: pack.rows.filter((row) => {
      const fulfillment = effectiveOrderItemFulfillmentStatus(
        row.orderItem,
        row.order,
      );
      if (isAdminPurchaseOrdersQueueFulfillment(fulfillment)) {
        return false;
      }
      return true;
    }),
  };
}

export async function listAdminPaidOrderHistoryLinesPage(
  clerkUser: User | null,
  queryInput: AdminListQuery,
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
    scope: resolveAdminPaidOrdersScope(queryInput.userId),
    query: queryInput,
  });
}
