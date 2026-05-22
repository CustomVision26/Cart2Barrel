import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { PaidOrdersQueryInput } from "@/lib/paid-orders-list-params";
import { propagateBatchContextWithinOrders } from "@/lib/partition-paid-order-batch-groups";
import { sortPaidOrderLinesWithinPage } from "@/lib/sort-paid-order-lines-for-display";
import { getDb } from "@/db";
import {
  batchQuoteSessions,
  batchQuoteSessionLines,
  itemRequests,
  orderItems,
  orders,
  profiles,
  type ItemRequest,
  type OrderItem,
} from "@/db/schema";
import { orderListSelect, type OrderListCore } from "@/data/order-list-select";
import {
  fulfilledProductReturnRequestsByOrderItemIds,
  pendingProductReturnRequestsByOrderItemIds,
  type FulfilledProductReturnRequestBrief,
  type PendingProductReturnRequestBrief,
} from "@/data/order-item-product-return-requests";
import {
  pendingRefundRequestsByOrderItemIds,
  type PendingRefundRequestBrief,
} from "@/data/order-item-refund-requests";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  isLikelyOrderFulfillmentEnumInQueryFailure,
  isUndefinedColumnError,
} from "@/lib/db-column-missing";
import { applyAdminOrdersQueueFulfillmentWhere } from "@/lib/admin-order-queue-fulfillment";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";

const batchDirect = alias(batchQuoteSessions, "paid_ord_batch_direct");
const batchViaLine = alias(batchQuoteSessions, "paid_ord_batch_via_line");

export type PaidOrderLineListRow = {
  orderItem: OrderItemReadCore;
  order: OrderListCore;
  request: ItemRequest;
  customerEmail: string | null;
  customerFullName: string | null;
  resolvedBatchSessionId: string | null;
  resolvedBatchNumber: string | null;
  refundedCents: number;
  pendingRefundRequest: PendingRefundRequestBrief | null;
  pendingProductReturnRequest: PendingProductReturnRequestBrief | null;
  fulfilledProductReturnRequest: FulfilledProductReturnRequestBrief | null;
};

export type PaidOrderLinesPageResult = {
  rows: PaidOrderLineListRow[];
  totalOrders: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: PaidOrdersQueryInput;
};

function isDeliveryReceivedFulfillmentStatus(
  s: OrderItem["fulfillmentStatus"],
): boolean {
  return String(s).startsWith("delivery_received_");
}

function shouldRetryPaidOrderLinesWithoutDeliveryReceivedFulfillment(
  e: unknown,
  lineFulfillmentIn?: OrderItem["fulfillmentStatus"][],
): boolean {
  if (!lineFulfillmentIn?.some(isDeliveryReceivedFulfillmentStatus)) return false;
  return isLikelyOrderFulfillmentEnumInQueryFailure(e);
}

const orderItemCoreSelect = {
  id: orderItems.id,
  orderId: orderItems.orderId,
  itemRequestId: orderItems.itemRequestId,
  quantity: orderItems.quantity,
  price: orderItems.price,
} as const;

const orderItemSelectWithFulfillment = {
  ...orderItemCoreSelect,
  fulfillmentStatus: orderItems.fulfillmentStatus,
  companyPurchaseTrackingUrl: orderItems.companyPurchaseTrackingUrl,
  companyPurchaseRetailerTrackingCompany:
    orderItems.companyPurchaseRetailerTrackingCompany,
  companyPurchaseRetailerTrackingNumber:
    orderItems.companyPurchaseRetailerTrackingNumber,
  companyPurchaseReceiptImageUrls: orderItems.companyPurchaseReceiptImageUrls,
  warehouseReceivedAt: orderItems.warehouseReceivedAt,
  warehouseReceivedQty: orderItems.warehouseReceivedQty,
  warehouseReceivedCondition: orderItems.warehouseReceivedCondition,
  warehouseShelfLocation: orderItems.warehouseShelfLocation,
  warehouseReceivedBarcode: orderItems.warehouseReceivedBarcode,
  warehouseReceivedBarcodeImageUrl: orderItems.warehouseReceivedBarcodeImageUrl,
  warehouseReceivedProofPhotoCount: orderItems.warehouseReceivedProofPhotoCount,
  warehouseReceivedProofPhotoUrls: orderItems.warehouseReceivedProofPhotoUrls,
} as const;

type LineSelect =
  | typeof orderItemSelectWithFulfillment
  | typeof orderItemCoreSelect;

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

function escapeIlikeGlob(q: string): string {
  return `%${q
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")}%`;
}

/** Search orders that have ≥1 matching line — batch session id/#, order id, line id, request id, Stripe ref, notes, profile, product title. */
/** Exported for `/admin/purchase-orders` queue filtering with the same semantics as paid-order lists. */
export function buildPaidOrdersSearchPredicate(qTrim: string): SQL | undefined {
  if (!qTrim) return undefined;
  const pat = escapeIlikeGlob(qTrim.trim());
  return or(
    ilike(sql<string>`CAST(${orders.id} AS TEXT)`, pat),
    ilike(sql<string>`CAST(${orderItems.id} AS TEXT)`, pat),
    ilike(sql<string>`CAST(${itemRequests.id} AS TEXT)`, pat),
    ilike(sql<string>`COALESCE(${orders.stripePaymentIntentId}, '')`, pat),
    ilike(sql<string>`COALESCE(${itemRequests.productName}, '')`, pat),
    ilike(sql<string>`COALESCE(${itemRequests.note}, '')`, pat),
    ilike(sql<string>`COALESCE(${profiles.fullName}, '')`, pat),
    ilike(sql<string>`COALESCE(${profiles.email}, '')`, pat),
    ilike(sql<string>`COALESCE(TRIM(${batchDirect.batchNumber}), '')`, pat),
    ilike(sql<string>`COALESCE(TRIM(${batchViaLine.batchNumber}), '')`, pat),
    ilike(sql<string>`CAST(${batchDirect.id} AS TEXT)`, pat),
    ilike(sql<string>`CAST(${batchViaLine.id} AS TEXT)`, pat),
  );
}

function buildWhereRoot(
  scope: "allPaidOrders" | { ownerClerkUserId: string },
  searchCond: SQL | undefined,
): SQL {
  const paid =
    scope === "allPaidOrders" ?
      eq(orders.status, "paid")
    : and(
        eq(orders.status, "paid"),
        eq(orders.clerkUserId, scope.ownerClerkUserId),
      )!;
  return searchCond ? and(paid, searchCond)! : paid;
}

function applyLineFulfillmentConstraints(
  paidWhere: SQL,
  opts: {
    lineFulfillmentIn?: OrderItem["fulfillmentStatus"][];
    /** Exclude order lines matching these statuses (AND with `lineFulfillmentIn` when both set). */
    lineFulfillmentExclude?: OrderItem["fulfillmentStatus"][];
  },
): SQL {
  let w = paidWhere;
  if (opts.lineFulfillmentIn?.length) {
    w = and(w, inArray(orderItems.fulfillmentStatus, opts.lineFulfillmentIn))!;
  }
  for (const status of opts.lineFulfillmentExclude ?? []) {
    w = and(w, ne(orderItems.fulfillmentStatus, status))!;
  }
  return w;
}

export async function attachRefundedCents(
  rows: Omit<
    PaidOrderLineListRow,
    | "refundedCents"
    | "pendingRefundRequest"
    | "pendingProductReturnRequest"
    | "fulfilledProductReturnRequest"
  >[],
): Promise<PaidOrderLineListRow[]> {
  if (rows.length === 0) return [];
  try {
    const sums = await sumRefundedCentsByOrderItemIds(rows.map((r) => r.orderItem.id));
    const base = rows.map((r) => ({
      ...r,
      refundedCents: sums.get(r.orderItem.id) ?? 0,
      pendingRefundRequest: null as PendingRefundRequestBrief | null,
      pendingProductReturnRequest: null as PendingProductReturnRequestBrief | null,
      fulfilledProductReturnRequest: null as FulfilledProductReturnRequestBrief | null,
    }));
    const withRefundReq = await attachPendingRefundRequestsToPaidLines(base);
    return attachProductReturnRequestsToPaidLines(withRefundReq);
  } catch {
    const base = rows.map((r) => ({
      ...r,
      refundedCents: 0,
      pendingRefundRequest: null as PendingRefundRequestBrief | null,
      pendingProductReturnRequest: null as PendingProductReturnRequestBrief | null,
      fulfilledProductReturnRequest: null as FulfilledProductReturnRequestBrief | null,
    }));
    const withRefundReq = await attachPendingRefundRequestsToPaidLines(base);
    return attachProductReturnRequestsToPaidLines(withRefundReq);
  }
}

export async function attachPendingRefundRequestsToPaidLines(
  rows: PaidOrderLineListRow[],
): Promise<PaidOrderLineListRow[]> {
  if (rows.length === 0) return rows;
  try {
    const map = await pendingRefundRequestsByOrderItemIds(
      rows.map((r) => r.orderItem.id),
    );
    return rows.map((r) => ({
      ...r,
      pendingRefundRequest: map.get(r.orderItem.id) ?? null,
    }));
  } catch {
    return rows.map((r) => ({ ...r, pendingRefundRequest: null }));
  }
}

export async function attachPendingProductReturnRequestsToPaidLines(
  rows: PaidOrderLineListRow[],
): Promise<PaidOrderLineListRow[]> {
  return attachProductReturnRequestsToPaidLines(rows);
}

export async function attachProductReturnRequestsToPaidLines(
  rows: PaidOrderLineListRow[],
): Promise<PaidOrderLineListRow[]> {
  if (rows.length === 0) return rows;
  try {
    const [pendingMap, fulfilledMap] = await Promise.all([
      pendingProductReturnRequestsByOrderItemIds(rows.map((r) => r.orderItem.id)),
      fulfilledProductReturnRequestsByOrderItemIds(rows.map((r) => r.orderItem.id)),
    ]);
    return rows.map((r) => ({
      ...r,
      pendingProductReturnRequest: pendingMap.get(r.orderItem.id) ?? null,
      fulfilledProductReturnRequest: fulfilledMap.get(r.orderItem.id) ?? null,
    }));
  } catch {
    return rows.map((r) => ({
      ...r,
      pendingProductReturnRequest: null,
      fulfilledProductReturnRequest: null,
    }));
  }
}

export async function attachPaidOrderLineWorkflowRequests(
  rows: Omit<
    PaidOrderLineListRow,
    | "refundedCents"
    | "pendingRefundRequest"
    | "pendingProductReturnRequest"
    | "fulfilledProductReturnRequest"
  >[],
): Promise<PaidOrderLineListRow[]> {
  const withRefunds = await attachRefundedCents(rows);
  const withRefundReq = await attachPendingRefundRequestsToPaidLines(withRefunds);
  return attachProductReturnRequestsToPaidLines(withRefundReq);
}

export function dedupePaidLineRows(
  rows: Omit<
    PaidOrderLineListRow,
    | "refundedCents"
    | "pendingRefundRequest"
    | "pendingProductReturnRequest"
    | "fulfilledProductReturnRequest"
  >[],
): Omit<
  PaidOrderLineListRow,
  | "refundedCents"
  | "pendingRefundRequest"
  | "pendingProductReturnRequest"
  | "fulfilledProductReturnRequest"
>[] {
  if (rows.length === 0) return [];
  const orderedIds: string[] = [];
  const merged = new Map<
    string,
    Omit<
      PaidOrderLineListRow,
      | "refundedCents"
      | "pendingRefundRequest"
      | "pendingProductReturnRequest"
      | "fulfilledProductReturnRequest"
    >
  >();

  const pickText = (
    primary: string | null | undefined,
    secondary: string | null | undefined,
  ): string | null => {
    const a =
      typeof primary === "string" && primary.trim().length > 0 ? primary.trim() : "";
    const b =
      typeof secondary === "string" && secondary.trim().length > 0 ?
        secondary.trim()
      : "";
    if (a.length > 0) return primary!.trim();
    if (b.length > 0) return secondary!.trim();
    return null;
  };

  for (const row of rows) {
    const lineId = row.orderItem.id;
    const prev = merged.get(lineId);
    if (!prev) {
      orderedIds.push(lineId);
      merged.set(lineId, row);
      continue;
    }
    merged.set(lineId, {
      ...prev,
      resolvedBatchSessionId: pickText(
        prev.resolvedBatchSessionId,
        row.resolvedBatchSessionId,
      ),
      resolvedBatchNumber: pickText(prev.resolvedBatchNumber, row.resolvedBatchNumber),
      customerEmail:
        prev.customerEmail?.trim()
          ? prev.customerEmail
          : row.customerEmail ?? null,
      customerFullName:
        prev.customerFullName?.trim()
          ? prev.customerFullName
          : row.customerFullName ?? null,
    });
  }

  return orderedIds.map((id) => merged.get(id)!);
}

async function selectOrderIdsPage(opts: {
  whereRoot: SQL;
  query: PaidOrdersQueryInput;
  hasFulfillmentColumn: boolean;
}): Promise<string[]> {
  const { whereRoot, query, hasFulfillmentColumn } = opts;
  const db = getDb();

  const grouped = db
    .select({ id: orders.id })
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
    .where(whereRoot)
    .groupBy(orders.id)
    .$dynamic();

  const customerSortKeyAgg = sql`MIN(LOWER(TRIM(COALESCE(${profiles.fullName}, COALESCE(${profiles.email}, '')))))`;
  const productSortKeyAgg =
    sql`MIN(LOWER(TRIM(COALESCE(${itemRequests.productName}, ''))))`;
  const batchSortKeyAgg =
    sql`MIN(LOWER(TRIM(COALESCE(${batchDirect.batchNumber}, COALESCE(${batchViaLine.batchNumber}, '')))))`;
  const lineTotalSumAgg = sql`SUM(${orderItems.price})`;
  const fulfillmentSortKeyAgg =
    sql`MIN(CAST(${orderItems.fulfillmentStatus} AS TEXT))`;

  switch (query.sort) {
    case "order_date_desc":
      grouped.orderBy(desc(sql`MAX(${orders.createdAt})`), desc(orders.id));
      break;
    case "order_date_asc":
      grouped.orderBy(asc(sql`MAX(${orders.createdAt})`), asc(orders.id));
      break;
    case "line_total_desc":
      grouped.orderBy(desc(lineTotalSumAgg), desc(orders.id));
      break;
    case "line_total_asc":
      grouped.orderBy(asc(lineTotalSumAgg), asc(orders.id));
      break;
    case "customer_az":
      grouped.orderBy(asc(customerSortKeyAgg), asc(orders.id));
      break;
    case "customer_za":
      grouped.orderBy(desc(customerSortKeyAgg), desc(orders.id));
      break;
    case "product_az":
      grouped.orderBy(asc(productSortKeyAgg), asc(orders.id));
      break;
    case "product_za":
      grouped.orderBy(desc(productSortKeyAgg), desc(orders.id));
      break;
    case "batch_az":
      grouped.orderBy(asc(batchSortKeyAgg), asc(orders.id));
      break;
    case "batch_za":
      grouped.orderBy(desc(batchSortKeyAgg), desc(orders.id));
      break;
    case "status_az":
      grouped.orderBy(
        hasFulfillmentColumn ?
          asc(fulfillmentSortKeyAgg)
        : asc(sql`MAX(${orders.createdAt})`),
        asc(orders.id),
      );
      break;
    case "status_za":
      grouped.orderBy(
        hasFulfillmentColumn ?
          desc(fulfillmentSortKeyAgg)
        : desc(sql`MAX(${orders.createdAt})`),
        desc(orders.id),
      );
      break;
    default:
      grouped.orderBy(desc(sql`MAX(${orders.createdAt})`), desc(orders.id));
  }

  const offset = (query.page - 1) * query.ps;
  const pageRows = await grouped.limit(query.ps).offset(offset);
  return pageRows.map((r) => r.id);
}

async function selectLinesForOrderIds(opts: {
  whereRoot: SQL;
  orderIds: string[];
  orderItemProj: LineSelect;
}): Promise<
  Omit<
    PaidOrderLineListRow,
    | "refundedCents"
    | "pendingRefundRequest"
    | "pendingProductReturnRequest"
    | "fulfilledProductReturnRequest"
  >[]
> {
  if (opts.orderIds.length === 0) return [];
  const db = getDb();
  const whereIn = and(opts.whereRoot, inArray(orders.id, opts.orderIds))!;

  const rows = await db
    .select({
      orderItem: opts.orderItemProj,
      order: orderListSelect,
      request: itemRequests,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
      resolvedBatchSessionId: resolvedBatchSessionIdSel,
      resolvedBatchNumber: resolvedBatchNumberSel,
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
    .where(whereIn);

  return rows.map((r) => ({
    orderItem: r.orderItem,
    order: r.order,
    request: r.request,
    customerEmail: r.customerEmail,
    customerFullName: r.customerFullName,
    resolvedBatchSessionId: r.resolvedBatchSessionId,
    resolvedBatchNumber: r.resolvedBatchNumber,
  }));
}

async function paginatePaidOrderLinesInner(opts: {
  scope: "allPaidOrders" | { ownerClerkUserId: string };
  query: PaidOrdersQueryInput;
  orderItemProj: LineSelect;
  hasFulfillmentColumn: boolean;
  lineFulfillmentIn?: OrderItem["fulfillmentStatus"][];
  lineFulfillmentExclude?: OrderItem["fulfillmentStatus"][];
  /** Paginate by filtered lines, but return every product line on each paged order. */
  expandFullOrderLines?: boolean;
  /** `/admin/orders` queue: excludes all `product_return_awaiting_delivery` lines. */
  adminOrdersQueue?: boolean;
}): Promise<Omit<PaidOrderLinesPageResult, "rows"> & { rows: PaidOrderLineListRow[] }> {
  const {
    scope,
    query,
    orderItemProj,
    hasFulfillmentColumn,
    lineFulfillmentIn,
    lineFulfillmentExclude,
    expandFullOrderLines,
    adminOrdersQueue,
  } = opts;
  const db = getDb();
  const searchCond = buildPaidOrdersSearchPredicate(query.q);
  const paidWhere = buildWhereRoot(scope, searchCond);
  const whereRoot =
    adminOrdersQueue ?
      applyAdminOrdersQueueFulfillmentWhere(paidWhere)
    : applyLineFulfillmentConstraints(paidWhere, {
        lineFulfillmentIn,
        lineFulfillmentExclude,
      });
  const whereAllLinesInPagedOrders =
    expandFullOrderLines ?
      adminOrdersQueue ?
        // Paginate by `/admin/orders` lane filters, but load every paid product line on
        // each order so batch siblings on purchase-orders / packages queues still appear
        // in the order-products detail (matches customer dashboard grouping).
        paidWhere
      : applyLineFulfillmentConstraints(paidWhere, { lineFulfillmentIn })
    : whereRoot;

  const [{ cnt }] = await db
    .select({ cnt: countDistinct(orders.id) })
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
    .where(whereRoot);

  const totalOrders = Number(cnt ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalOrders / query.ps));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const effectiveQuery: PaidOrdersQueryInput =
    page === query.page ? query : { ...query, page };

  if (totalOrders === 0) {
    return {
      rows: [],
      totalOrders,
      page: 1,
      pageSize: query.ps,
      totalPages,
      query,
    };
  }

  const orderIds = await selectOrderIdsPage({
    whereRoot,
    query: effectiveQuery,
    hasFulfillmentColumn,
  });

  const fetchedLines = await selectLinesForOrderIds({
    whereRoot: whereAllLinesInPagedOrders,
    orderIds,
    orderItemProj,
  });
  let bareLines = dedupePaidLineRows(fetchedLines);
  if (expandFullOrderLines) {
    bareLines = propagateBatchContextWithinOrders(bareLines);
  }

  const sorted = sortPaidOrderLinesWithinPage(bareLines, orderIds);
  const rows = await attachPaidOrderLineWorkflowRequests(sorted);

  return {
    rows,
    totalOrders,
    page,
    pageSize: query.ps,
    totalPages,
    query: effectiveQuery,
  };
}

export async function listPaidOrderLinesPage(opts: {
  scope: "allPaidOrders" | { ownerClerkUserId: string };
  query: PaidOrdersQueryInput;
  /** When set, only lines whose DB fulfillment status matches are listed (counts/paging by order). */
  lineFulfillmentIn?: OrderItem["fulfillmentStatus"][];
  /** Excludes matching lines from results (pagination counts orders that still have ≥1 qualifying line). */
  lineFulfillmentExclude?: OrderItem["fulfillmentStatus"][];
  /**
   * When set with `lineFulfillmentExclude` / `lineFulfillmentIn`, paging still uses line filters,
   * but each paged order includes all of its paid product lines (batch siblings stay visible).
   */
  expandFullOrderLines?: boolean;
  adminOrdersQueue?: boolean;
}): Promise<PaidOrderLinesPageResult> {
  try {
    return await paginatePaidOrderLinesInner({
      scope: opts.scope,
      query: opts.query,
      orderItemProj: orderItemSelectWithFulfillment,
      hasFulfillmentColumn: true,
      lineFulfillmentIn: opts.lineFulfillmentIn,
      lineFulfillmentExclude: opts.lineFulfillmentExclude,
      expandFullOrderLines: opts.expandFullOrderLines,
      adminOrdersQueue: opts.adminOrdersQueue,
    });
  } catch (e) {
    if (
      opts.lineFulfillmentIn?.includes("product_return_awaiting_delivery") &&
      isLikelyOrderFulfillmentEnumInQueryFailure(e)
    ) {
      const withoutProductReturn = opts.lineFulfillmentIn.filter(
        (s) => s !== "product_return_awaiting_delivery",
      );
      if (withoutProductReturn.length > 0) {
        return await listPaidOrderLinesPage({
          ...opts,
          lineFulfillmentIn: withoutProductReturn,
        });
      }
      return {
        rows: [],
        totalOrders: 0,
        page: 1,
        pageSize: opts.query.ps,
        totalPages: 1,
        query: opts.query,
      };
    }
    if (
      shouldRetryPaidOrderLinesWithoutDeliveryReceivedFulfillment(
        e,
        opts.lineFulfillmentIn,
      )
    ) {
      const withoutDeliveryReceived = opts.lineFulfillmentIn!.filter(
        (s) => !isDeliveryReceivedFulfillmentStatus(s),
      );
      if (withoutDeliveryReceived.length > 0) {
        return await listPaidOrderLinesPage({
          ...opts,
          lineFulfillmentIn: withoutDeliveryReceived,
        });
      }
      return {
        rows: [],
        totalOrders: 0,
        page: 1,
        pageSize: opts.query.ps,
        totalPages: 1,
        query: opts.query,
      };
    }
    if (isUndefinedColumnError(e, "fulfillment_status")) {
      return await paginatePaidOrderLinesInner({
        scope: opts.scope,
        query: opts.query,
        orderItemProj: orderItemCoreSelect,
        hasFulfillmentColumn: false,
        lineFulfillmentIn: opts.lineFulfillmentIn,
        lineFulfillmentExclude: opts.lineFulfillmentExclude,
        expandFullOrderLines: opts.expandFullOrderLines,
      });
    }
    throw e;
  }
}
