import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { AdminListQuery } from "@/lib/admin-customer-filter";
import type {
  PaidOrderLineSort,
  PaidOrdersQueryInput,
} from "@/lib/paid-orders-list-params";
import { getDb } from "@/db";
import {
  batchQuoteSessions,
  batchQuoteSessionLines,
  itemRequests,
  orderItems,
  orders,
  profiles,
  type OrderItem,
} from "@/db/schema";
import {
  orderItemAdminUpdatedByNulls,
  orderItemFulfillmentCoreSelect,
  orderItemFulfillmentCoreSelectWithWarehouse,
  orderItemFulfillmentCoreSelectWithWarehouseAndAdminUpdatedBy,
  orderItemWarehouseReceiptNulls,
  orderListSelect,
} from "@/data/order-list-select";
import {
  attachPaidOrderLineWorkflowRequests,
  buildPaidOrdersSearchPredicate,
  dedupePaidLineRows,
  type PaidOrderLineListRow,
} from "@/data/paid-orders-queries";
import { mapLatestOperationalQuoteItemCostByRequestIds } from "@/data/item-quotes";
import {
  isMissingOrderItemAdminUpdatedByColumnsError,
  isMissingOrderItemWarehouseReceiptColumnsError,
  isUndefinedColumnError,
  isInvalidOrderItemFulfillmentStatusEnumError,
} from "@/lib/db-column-missing";
import {
  productReturnAwaitingDeliveryOnPurchaseOrders,
} from "@/lib/admin-order-queue-fulfillment";
import { excludeDeliveryConditionAcceptedAwaitingBarrelSql } from "@/lib/delivery-condition-acceptance";
import {
  ADMIN_PACKAGES_QUEUE_FULFILLMENT_STATUSES,
  ADMIN_PURCHASE_ORDERS_QUEUE_BASE_FULFILLMENT_STATUSES,
  ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES,
} from "@/lib/warehouse-receipt-queue";

const batchDirect = alias(batchQuoteSessions, "paid_ord_batch_direct");
const batchViaLine = alias(batchQuoteSessions, "paid_ord_batch_via_line");

const resolvedBatchSessionIdSel = sql<string | null>`
  CAST(
    COALESCE(
      CAST(${batchDirect.id} AS text),
      CAST(${batchViaLine.id} AS text)
    ) AS TEXT
  )
`;

const resolvedBatchNumberSel = sql<
  string | null
>`NULLIF(TRIM(COALESCE(${batchDirect.batchNumber}, ${batchViaLine.batchNumber}, '')), '')`;

/**
 * Purchase orders: inbound coordination, problem receipts, replacement returns in transit,
 * and money-back returns awaiting refund (`Product Returned: awaiting refund`).
 */
function postApprovedPurchaseWhere(
  fulfillmentStatuses: OrderItem["fulfillmentStatus"][] = ADMIN_PURCHASE_ORDERS_QUEUE_BASE_FULFILLMENT_STATUSES,
): SQL {
  const baseStatuses = fulfillmentStatuses.filter(
    (s) => s !== "product_return_awaiting_delivery",
  );
  return and(
    eq(orders.status, "paid"),
    or(
      inArray(orderItems.fulfillmentStatus, baseStatuses),
      productReturnAwaitingDeliveryOnPurchaseOrders(),
    )!,
    excludeDeliveryConditionAcceptedAwaitingBarrelSql(),
  )!;
}

/** Package file inventory (`/admin/packages`): awaiting barrel and in-container lines. */
function packagesAwaitingBarrelWhere(): SQL {
  return and(
    eq(orders.status, "paid"),
    inArray(orderItems.fulfillmentStatus, [
      ...ADMIN_PACKAGES_QUEUE_FULFILLMENT_STATUSES,
    ]),
  )!;
}

export type AdminPurchaseQueueMode = "purchase_pending" | "packages_awaiting_barrel";

function queueBaseWhere(
  mode: AdminPurchaseQueueMode,
  purchasePendingFulfillmentIn?: OrderItem["fulfillmentStatus"][],
): SQL {
  return mode === "packages_awaiting_barrel" ?
      packagesAwaitingBarrelWhere()
    : postApprovedPurchaseWhere(
        purchasePendingFulfillmentIn ?? ADMIN_PURCHASE_ORDERS_QUEUE_FULFILLMENT_STATUSES,
      );
}

function purchaseQueueOrderBy(sort: PaidOrderLineSort): SQL[] {
  const orderDateDesc = desc(sql`MAX(${orders.createdAt})`);
  const orderDateAsc = asc(sql`MAX(${orders.createdAt})`);
  const lineIdDesc = desc(orderItems.id);

  switch (sort) {
    case "order_date_asc":
      return [orderDateAsc, asc(orderItems.id)];
    case "line_total_desc":
      return [desc(sql`MAX(${orderItems.price})`), orderDateDesc, lineIdDesc];
    case "line_total_asc":
      return [asc(sql`MAX(${orderItems.price})`), orderDateDesc, lineIdDesc];
    case "customer_az":
      return [
        asc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(${profiles.fullName}), ''), NULLIF(TRIM(${profiles.email}), ''), ${orders.clerkUserId})))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "customer_za":
      return [
        desc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(${profiles.fullName}), ''), NULLIF(TRIM(${profiles.email}), ''), ${orders.clerkUserId})))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "product_az":
      return [
        asc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(${itemRequests.productName}), ''), 'Unnamed product')))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "product_za":
      return [
        desc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(${itemRequests.productName}), ''), 'Unnamed product')))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "batch_az":
      return [
        asc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(COALESCE(${batchDirect.batchNumber}, ${batchViaLine.batchNumber}, '')), ''), '')))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "batch_za":
      return [
        desc(
          sql`LOWER(MAX(COALESCE(NULLIF(TRIM(COALESCE(${batchDirect.batchNumber}, ${batchViaLine.batchNumber}, '')), ''), '')))`,
        ),
        orderDateDesc,
        lineIdDesc,
      ];
    case "status_az":
      return [
        asc(sql`MAX(CAST(${orderItems.fulfillmentStatus} AS text))`),
        orderDateDesc,
        lineIdDesc,
      ];
    case "status_za":
      return [
        desc(sql`MAX(CAST(${orderItems.fulfillmentStatus} AS text))`),
        orderDateDesc,
        lineIdDesc,
      ];
    case "order_date_desc":
      return [orderDateDesc, lineIdDesc];
  }
}

export type PurchaseQueueLineRow = PaidOrderLineListRow & {
  quotedItemCostCents: number | null;
};

export type PurchaseQueuePageResult = {
  rows: PurchaseQueueLineRow[];
  totalLines: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: PaidOrdersQueryInput;
};

async function fetchLineRowsForIds(
  ids: string[],
): Promise<
  Omit<
    PaidOrderLineListRow,
    | "refundedCents"
    | "pendingRefundRequest"
    | "pendingProductReturnRequest"
    | "fulfilledProductReturnRequest"
  >[]
> {
  if (ids.length === 0) return [];
  const db = getDb();

  const baseSelect = {
    order: orderListSelect,
    request: itemRequests,
    customerEmail: profiles.email,
    customerFullName: profiles.fullName,
    resolvedBatchSessionId: resolvedBatchSessionIdSel,
    resolvedBatchNumber: resolvedBatchNumberSel,
  } as const;

  try {
    const rows = await db
      .select({
        ...baseSelect,
        orderItem: orderItemFulfillmentCoreSelectWithWarehouseAndAdminUpdatedBy,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .leftJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
      .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
      .leftJoin(
        batchQuoteSessionLines,
        eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
      )
      .leftJoin(
        batchViaLine,
        eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
      )
      .where(inArray(orderItems.id, ids));

    return rows.map((r) => ({
      orderItem: r.orderItem,
      order: r.order,
      request: r.request,
      customerEmail: r.customerEmail,
      customerFullName: r.customerFullName,
      resolvedBatchSessionId: r.resolvedBatchSessionId,
      resolvedBatchNumber: r.resolvedBatchNumber,
    }));
  } catch (e) {
    if (isMissingOrderItemAdminUpdatedByColumnsError(e)) {
      try {
        const rows = await db
          .select({
            ...baseSelect,
            orderItem: orderItemFulfillmentCoreSelectWithWarehouse,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
          .leftJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
          .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
          .leftJoin(
            batchQuoteSessionLines,
            eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
          )
          .leftJoin(
            batchViaLine,
            eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
          )
          .where(inArray(orderItems.id, ids));

        return rows.map((r) => ({
          orderItem: { ...r.orderItem, ...orderItemAdminUpdatedByNulls },
          order: r.order,
          request: r.request,
          customerEmail: r.customerEmail,
          customerFullName: r.customerFullName,
          resolvedBatchSessionId: r.resolvedBatchSessionId,
          resolvedBatchNumber: r.resolvedBatchNumber,
        }));
      } catch (inner) {
        if (!isMissingOrderItemWarehouseReceiptColumnsError(inner)) throw inner;
      }
    } else if (!isMissingOrderItemWarehouseReceiptColumnsError(e)) {
      throw e;
    }

    const rows = await db
      .select({
        ...baseSelect,
        orderItem: orderItemFulfillmentCoreSelect,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .leftJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
      .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
      .leftJoin(
        batchQuoteSessionLines,
        eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
      )
      .leftJoin(
        batchViaLine,
        eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
      )
      .where(inArray(orderItems.id, ids));

    return rows.map((r) => ({
      orderItem: {
        ...r.orderItem,
        ...orderItemWarehouseReceiptNulls,
        ...orderItemAdminUpdatedByNulls,
      },
      order: r.order,
      request: r.request,
      customerEmail: r.customerEmail,
      customerFullName: r.customerFullName,
      resolvedBatchSessionId: r.resolvedBatchSessionId,
      resolvedBatchNumber: r.resolvedBatchNumber,
    }));
  }
}

async function listPurchaseQueueInner(
  queryInput: AdminListQuery,
  mode: AdminPurchaseQueueMode,
  purchasePendingFulfillmentIn?: OrderItem["fulfillmentStatus"][],
): Promise<PurchaseQueuePageResult> {
  const db = getDb();
  const searchCond = buildPaidOrdersSearchPredicate(queryInput.q);
  const baseWhere = queueBaseWhere(mode, purchasePendingFulfillmentIn);
  const ownerWhere =
    queryInput.userId ?
      and(baseWhere, eq(orders.clerkUserId, queryInput.userId))!
    : baseWhere;
  const whereCombined =
    searchCond ? and(ownerWhere, searchCond)! : ownerWhere;

  const [{ cnt }] = await db
    .select({
      cnt: sql<number>`CAST(COUNT(DISTINCT ${orderItems.id}) AS INTEGER)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
    )
    .leftJoin(
      batchViaLine,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
    )
    .where(whereCombined);

  const totalLines = Number(cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalLines / queryInput.ps));
  const page = Math.min(Math.max(1, queryInput.page), totalPages);
  const effectiveQuery: PaidOrdersQueryInput =
    page === queryInput.page ? queryInput : { ...queryInput, page };

  if (totalLines === 0) {
    return {
      rows: [],
      totalLines: 0,
      page: 1,
      pageSize: queryInput.ps,
      totalPages,
      query: queryInput,
    };
  }

  const offset = (page - 1) * effectiveQuery.ps;
  const orderBy = purchaseQueueOrderBy(effectiveQuery.sort);

  const idRows = await db
    .select({ lineId: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(batchQuoteSessionLines.itemRequestId, itemRequests.id),
    )
    .leftJoin(
      batchViaLine,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
    )
    .where(whereCombined)
    .groupBy(orderItems.id)
    .orderBy(...orderBy)
    .limit(effectiveQuery.ps)
    .offset(offset);

  const ids = idRows.map((r) => r.lineId);
  const fetched = dedupePaidLineRows(await fetchLineRowsForIds(ids));
  const orderIndex = new Map(ids.map((id, i) => [id, i]));
  fetched.sort(
    (a, b) =>
      (orderIndex.get(a.orderItem.id) ?? 0) -
      (orderIndex.get(b.orderItem.id) ?? 0),
  );

  const withWorkflow = await attachPaidOrderLineWorkflowRequests(fetched);
  const quoteMap = await mapLatestOperationalQuoteItemCostByRequestIds(
    withWorkflow.map((r) => r.request.id),
  );

  const rows: PurchaseQueueLineRow[] = withWorkflow.map((r) => ({
    ...r,
    quotedItemCostCents: quoteMap.get(r.request.id) ?? null,
  }));

  return {
    rows,
    totalLines,
    page,
    pageSize: effectiveQuery.ps,
    totalPages,
    query: effectiveQuery,
  };
}

export async function listAdminPurchaseQueuePage(
  queryInput: AdminListQuery,
): Promise<PurchaseQueuePageResult> {
  try {
    return await listPurchaseQueueInner(queryInput, "purchase_pending");
  } catch (e) {
    if (!isUndefinedColumnError(e, "fulfillment_status")) {
      throw e;
    }
    return {
      rows: [],
      totalLines: 0,
      page: 1,
      pageSize: queryInput.ps,
      totalPages: 1,
      query: queryInput,
    };
  }
}

export async function listAdminPackagesQueuePage(
  queryInput: AdminListQuery,
): Promise<PurchaseQueuePageResult> {
  try {
    return await listPurchaseQueueInner(queryInput, "packages_awaiting_barrel");
  } catch (e) {
    if (
      isUndefinedColumnError(e, "fulfillment_status") ||
      isInvalidOrderItemFulfillmentStatusEnumError(e)
    ) {
      return {
        rows: [],
        totalLines: 0,
        page: 1,
        pageSize: queryInput.ps,
        totalPages: 1,
        query: queryInput,
      };
    }
    throw e;
  }
}
