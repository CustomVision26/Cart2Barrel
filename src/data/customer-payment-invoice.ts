import "server-only";

import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type Stripe from "stripe";

import { getPrimaryShippingAddress, listShippingAddressesForUser } from "@/data/addresses";
import { listHubStockOrderItemsByOrderId } from "@/data/hub-stock-cart";
import { loadHubShipFromSettings } from "@/data/hub-ship-from";
import { listHubStockOrderPackingByOrderIds } from "@/data/hub-stock-order-packing";
import { listOrderContainerItemsByOrderIds } from "@/data/order-container-admin";
import { getDb } from "@/db";
import {
  batchQuoteSessionLines,
  batchQuoteSessions,
  itemRequests,
  orderItems,
  orders,
  profiles,
  type HubStockOrderItem,
} from "@/db/schema";
import type { HubStockOrderPackingPackage } from "@/lib/hub-stock-box";
import { formatHubStockUsAddress, hubStockUsShipToKey } from "@/lib/hub-stock";
import { getInvoiceCompanyProfile } from "@/lib/invoice/company-profile";
import {
  billToFromHubUsShipTo,
  invoiceCompanyFromHubShipFrom,
  matchSavedAddressToHubUsShipTo,
  pickHubUsShipToSnapshot,
} from "@/lib/invoice/hub-us-receipt-addresses";
import { buildPaymentInvoiceProductDetail } from "@/lib/invoice/payment-invoice-line-detail";
import {
  buildInvoiceNumber,
  buildReceiptNumber,
  formatCardPaymentMethodLabel,
} from "@/lib/invoice/payment-invoice-format";
import type {
  PaymentInvoiceBillTo,
  PaymentInvoiceDocument,
  PaymentInvoiceLine,
  PaymentInvoiceLineKind,
  PaymentInvoicePackingNote,
  PaymentInvoicePaymentRow,
} from "@/lib/invoice/payment-invoice-types";
import { isStripePaymentIntentId } from "@/lib/stripe-refund-receipt";
import { getStripeServer } from "@/lib/stripe-server";

export type CustomerPaymentInvoiceResult =
  | { ok: true; invoice: PaymentInvoiceDocument }
  | { ok: false; message: string };

type StripeCheckoutLine = {
  description: string;
  detail: string | null;
  quantity: number;
  amountCents: number;
};

const batchDirect = alias(batchQuoteSessions, "invoice_batch_direct");
const batchViaLine = alias(batchQuoteSessions, "invoice_batch_via_line");

const resolvedBatchNumberSel = sql<
  string | null
>`NULLIF(TRIM(COALESCE(${batchDirect.batchNumber}, ${batchViaLine.batchNumber}, '')), '')`;

function addressLinesFromProfile(
  fullName: string | null,
  address:
    | {
        recipientName?: string | null;
        recipientPhone?: string | null;
        line1: string | null;
        line2: string | null;
        cityOrTown: string | null;
        parish: string | null;
        postalCode: string | null;
        country: string | null;
      }
    | undefined,
): string[] {
  const lines: string[] = [];
  const name = address?.recipientName?.trim() || fullName?.trim();
  if (name) lines.push(name);
  if (address?.recipientPhone?.trim()) lines.push(address.recipientPhone.trim());

  if (address) {
    if (address.line1?.trim()) lines.push(address.line1.trim());
    if (address.line2?.trim()) lines.push(address.line2.trim());

    const city = address.cityOrTown?.trim() ?? "";
    const parish = address.parish?.trim() ?? "";
    const postal = address.postalCode?.trim() ?? "";
    const country = address.country?.trim() ?? "";

    const locality = [city, parish].filter(Boolean).join(", ");
    const cityLine = [locality, postal].filter(Boolean).join(" ");
    if (cityLine) lines.push(cityLine);
    if (country) lines.push(country);
  }

  return lines;
}

function packingNotesFromPackages(
  packages: HubStockOrderPackingPackage[],
): PaymentInvoicePackingNote[] {
  return packages.map((pkg) => {
    if (pkg.destination !== "us_address") {
      return {
        title: "Overseas hub packing",
        detail: `${pkg.itemCount} in-hub ${pkg.itemCount === 1 ? "product" : "products"} packed into the customer's overseas container. No US outbound box.`,
      };
    }
    const parts = [
      pkg.boxSizeLabel ??
        "Box size not on file — add parcel dimensions on the in-hub product.",
      `${pkg.itemCount} ${pkg.itemCount === 1 ? "product" : "products"} · ${pkg.unitCount} ${pkg.unitCount === 1 ? "unit" : "units"}`,
      pkg.shippingLabel,
    ].filter((part): part is string => Boolean(part));
    return {
      title: "Warehouse package (US in-hub)",
      detail: parts.join(" · "),
    };
  });
}

function toInvoiceLine(
  description: string,
  detail: string | null,
  quantity: number,
  amountCents: number,
  kind: PaymentInvoiceLineKind = "item",
): PaymentInvoiceLine {
  const qty = Math.max(1, quantity);
  const unitPriceCents = Math.round(amountCents / qty);
  return {
    description,
    detail,
    quantity: qty,
    unitPriceCents,
    amountCents,
    kind,
  };
}

function carrierServiceLabel(carrier: string | null, service: string | null): string | null {
  const label = [carrier, service]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return label || null;
}

function warehousePackageShippingLines(
  shares: Array<{ item: HubStockOrderItem; shippingCents: number }>,
): PaymentInvoiceLine[] {
  const usGroups = new Map<string, typeof shares>();
  for (const share of shares) {
    if (share.item.destination !== "us_address") continue;
    const key =
      hubStockUsShipToKey(share.item) ?? `incomplete:${share.item.orderItemId}`;
    const group = usGroups.get(key) ?? [];
    group.push(share);
    usGroups.set(key, group);
  }

  const lines: PaymentInvoiceLine[] = [];
  for (const group of usGroups.values()) {
    const shippingCents = group.reduce(
      (sum, row) => sum + Math.max(0, row.shippingCents),
      0,
    );
    if (shippingCents <= 0) continue;
    const rated = group.find(
      (row) => row.item.shippingCarrier || row.item.shippingService,
    );
    const shipToSource = group.find(
      (row) => row.item.shipLine1?.trim() || row.item.shipCity?.trim(),
    )?.item;
    const detailParts = [
      carrierServiceLabel(
        rated?.item.shippingCarrier ?? null,
        rated?.item.shippingService ?? null,
      ),
      shipToSource ?
        formatHubStockUsAddress({
          line1: shipToSource.shipLine1,
          line2: shipToSource.shipLine2,
          city: shipToSource.shipCity,
          state: shipToSource.shipState,
          postalCode: shipToSource.shipPostalCode,
          country: shipToSource.shipCountry,
        })
      : null,
    ].filter((part): part is string => Boolean(part));
    lines.push(
      toInvoiceLine(
        "Warehouse package shipping",
        detailParts.length > 0 ? detailParts.join(" · ") : "US in-hub warehouse package",
        1,
        shippingCents,
        "shipping",
      ),
    );
  }
  return lines;
}

function linesFromStripeSession(session: Stripe.Checkout.Session): StripeCheckoutLine[] {
  const raw = session.line_items;
  if (!raw || typeof raw !== "object" || !("data" in raw)) return [];
  const data = (raw as { data: Stripe.LineItem[] }).data;
  if (!Array.isArray(data)) return [];

  return data
    .map((line) => {
      const amountCents = line.amount_total ?? 0;
      if (amountCents <= 0) return null;
      const description =
        line.description?.trim() ||
        (typeof line.price?.product === "object" &&
        line.price.product &&
        "name" in line.price.product
          ? String(line.price.product.name ?? "").trim()
          : "") ||
        "Checkout line";
      const detail =
        typeof line.price?.product === "object" &&
        line.price.product &&
        "description" in line.price.product
          ? String(line.price.product.description ?? "").trim() || null
          : null;
      return {
        description,
        detail,
        quantity: typeof line.quantity === "number" && line.quantity > 0 ? line.quantity : 1,
        amountCents,
      };
    })
    .filter((line): line is StripeCheckoutLine => line !== null);
}

async function linesFromDatabase(
  orderId: string,
  hubOrderItems: HubStockOrderItem[],
): Promise<PaymentInvoiceLine[]> {
  const db = getDb();
  const productRows = await db
    .select({
      orderItemId: orderItems.id,
      productName: itemRequests.productName,
      quantity: orderItems.quantity,
      price: orderItems.price,
      siteName: itemRequests.siteName,
      outsidePurchaseReference: itemRequests.outsidePurchaseReference,
      productUrl: itemRequests.productUrl,
      source: itemRequests.source,
      batchNumber: resolvedBatchNumberSel,
    })
    .from(orderItems)
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(batchDirect, eq(itemRequests.batchQuoteSessionId, batchDirect.id))
    .leftJoin(
      batchQuoteSessionLines,
      eq(itemRequests.id, batchQuoteSessionLines.itemRequestId),
    )
    .leftJoin(
      batchViaLine,
      eq(batchQuoteSessionLines.batchQuoteSessionId, batchViaLine.id),
    )
    .where(eq(orderItems.orderId, orderId));

  const containerMap = await listOrderContainerItemsByOrderIds([orderId]);
  const containerRows = containerMap.get(orderId) ?? [];
  const hubByOrderItemId = new Map(
    hubOrderItems.map((row) => [row.orderItemId, row] as const),
  );

  const lines: PaymentInvoiceLine[] = [];
  const hubShippingShares: Array<{ item: HubStockOrderItem; shippingCents: number }> = [];

  for (const row of productRows) {
    const name = row.productName?.trim() || "Requested item";
    const hub = hubByOrderItemId.get(row.orderItemId);
    const merchandiseCents =
      hub != null ? Math.max(0, hub.unitPriceCents * hub.quantity) : row.price;
    if (hub != null && hub.destination === "us_address") {
      const shippingCents =
        hub.shippingCents > 0 ? hub.shippingCents : Math.max(0, row.price - merchandiseCents);
      hubShippingShares.push({ item: hub, shippingCents });
    }
    const detail = buildPaymentInvoiceProductDetail({
      siteName: row.siteName,
      batchNumber: row.batchNumber,
      orderItemId: row.orderItemId,
      outsidePurchaseReference: row.outsidePurchaseReference,
      productUrl: row.productUrl,
      source: row.source,
      quantity: row.quantity,
    });
    lines.push(toInvoiceLine(name, detail, row.quantity, merchandiseCents));
  }

  for (const row of containerRows) {
    const label = `${row.nameSnapshot.trim()} (${row.sizeSnapshot.trim()})`;
    lines.push(
      toInvoiceLine(
        label,
        row.kindSnapshot === "bin" ? "Storage bin"
        : row.kindSnapshot === "suitcase" ? "Suitcase"
        : "Shipping barrel",
        row.quantity,
        row.lineTotalCents,
      ),
    );
  }

  lines.push(...warehousePackageShippingLines(hubShippingShares));

  return lines;
}

function reconcileInvoiceLines(
  lines: PaymentInvoiceLine[],
  orderTotalCents: number,
): PaymentInvoiceLine[] {
  if (lines.length === 0) {
    return [
      toInvoiceLine("Order checkout", null, 1, orderTotalCents),
    ];
  }

  const lineSum = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const delta = orderTotalCents - lineSum;
  if (delta === 0) return lines;

  return [
    ...lines,
    toInvoiceLine(
      delta > 0 ? "Checkout fees & adjustments" : "Checkout credit & adjustments",
      null,
      1,
      delta,
    ),
  ];
}

async function loadStripeCheckoutLines(
  checkoutSessionId: string | null,
): Promise<StripeCheckoutLine[] | null> {
  const sessionId = checkoutSessionId?.trim();
  if (!sessionId) return null;

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product"],
    });
    const lines = linesFromStripeSession(session);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

async function loadStripePaymentDetails(paymentIntentId: string): Promise<{
  paidAt: string;
  receiptNumber: string | null;
  methodLabel: string;
} | null> {
  if (!isStripePaymentIntentId(paymentIntentId)) return null;

  try {
    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const latest = intent.latest_charge;
    let charge: Stripe.Charge | null = null;

    if (typeof latest === "object" && latest !== null) {
      charge = latest;
    } else if (typeof latest === "string" && latest.startsWith("ch_")) {
      charge = await stripe.charges.retrieve(latest);
    }

    const paidAt = charge?.created
      ? new Date(charge.created * 1000).toISOString()
      : new Date().toISOString();

    const card = charge?.payment_method_details?.card;
    const methodLabel = formatCardPaymentMethodLabel(card?.brand, card?.last4);

    return {
      paidAt,
      receiptNumber: charge?.receipt_number?.trim() || null,
      methodLabel,
    };
  } catch {
    return null;
  }
}

export async function getPaidOrderInvoiceForAdmin(
  orderId: string,
): Promise<CustomerPaymentInvoiceResult> {
  const trimmed = orderId.trim();
  if (!trimmed) {
    return { ok: false, message: "Missing order reference." };
  }
  const db = getDb();
  const [order] = await db
    .select({ clerkUserId: orders.clerkUserId })
    .from(orders)
    .where(eq(orders.id, trimmed))
    .limit(1);
  if (!order) {
    return { ok: false, message: "Order not found." };
  }
  return getCustomerPaymentInvoice({
    clerkUserId: order.clerkUserId,
    orderId: trimmed,
  });
}
export async function getCustomerPaymentInvoice(opts: {
  clerkUserId: string;
  orderId: string;
}): Promise<CustomerPaymentInvoiceResult> {
  const orderId = opts.orderId.trim();
  if (!orderId) {
    return { ok: false, message: "Missing order reference." };
  }

  const db = getDb();
  const [order] = await db
    .select({
      id: orders.id,
      clerkUserId: orders.clerkUserId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      createdAt: orders.createdAt,
      stripePaymentIntentId: orders.stripePaymentIntentId,
      stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false, message: "Order not found." };
  }
  if (order.clerkUserId !== opts.clerkUserId) {
    return { ok: false, message: "You do not have access to this receipt." };
  }
  if (order.status !== "paid") {
    return { ok: false, message: "This order has not been paid yet." };
  }

  const [profile] = await db
    .select({
      fullName: profiles.fullName,
      email: profiles.email,
      phone: profiles.phone,
    })
    .from(profiles)
    .where(eq(profiles.clerkUserId, opts.clerkUserId))
    .limit(1);

  const shippingAddress = await getPrimaryShippingAddress(opts.clerkUserId);
  const hubOrderItems = await listHubStockOrderItemsByOrderId(orderId);
  const hubUsShipTo = pickHubUsShipToSnapshot(hubOrderItems);

  let company = getInvoiceCompanyProfile();
  let billTo: PaymentInvoiceBillTo = {
    name: profile?.fullName?.trim() || "Customer",
    addressLines: addressLinesFromProfile(profile?.fullName ?? null, shippingAddress),
    email: profile?.email?.trim() || null,
  };

  if (hubUsShipTo) {
    const hubFrom = await loadHubShipFromSettings();
    company = invoiceCompanyFromHubShipFrom(hubFrom, company);
    const savedAddresses = await listShippingAddressesForUser(opts.clerkUserId);
    const matchedUsAddress = matchSavedAddressToHubUsShipTo(
      savedAddresses,
      hubUsShipTo,
    );
    billTo = billToFromHubUsShipTo({
      snap: hubUsShipTo,
      matchedAddress: matchedUsAddress,
      fallbackName: profile?.fullName?.trim() || "Customer",
      email: profile?.email?.trim() || null,
    });
  }

  const dbLines = await linesFromDatabase(orderId, hubOrderItems);
  const stripeLines = await loadStripeCheckoutLines(order.stripeCheckoutSessionId);
  const rawLines =
    dbLines.length > 0
      ? dbLines
      : (stripeLines?.map((line) =>
          toInvoiceLine(line.description, line.detail, line.quantity, line.amountCents),
        ) ?? []);

  const lines = reconcileInvoiceLines(rawLines, order.totalAmount);

  const paymentIntentId = order.stripePaymentIntentId?.trim() ?? "";
  const stripePayment = paymentIntentId
    ? await loadStripePaymentDetails(paymentIntentId)
    : null;

  const datePaid = stripePayment?.paidAt ?? order.createdAt;
  const receiptNumber = buildReceiptNumber(orderId, stripePayment?.receiptNumber ?? null);
  const invoiceNumber = buildInvoiceNumber(orderId);

  const paymentRow: PaymentInvoicePaymentRow = {
    methodLabel: stripePayment?.methodLabel ?? "Online payment",
    paidAt: datePaid,
    amountCents: order.totalAmount,
    receiptNumber,
  };

  const shippingCents = lines
    .filter((line) => line.kind === "shipping")
    .reduce((sum, line) => sum + line.amountCents, 0);
  const subtotalCents = lines
    .filter((line) => line.kind !== "shipping")
    .reduce((sum, line) => sum + line.amountCents, 0);

  const packingMap = await listHubStockOrderPackingByOrderIds([orderId]);
  const packingNotes = packingNotesFromPackages(packingMap.get(orderId) ?? []);

  return {
    ok: true,
    invoice: {
      orderId,
      invoiceNumber,
      receiptNumber,
      datePaid,
      amountPaidCents: order.totalAmount,
      currency: "USD",
      company,
      billTo,
      lines,
      packingNotes,
      subtotalCents,
      shippingCents,
      totalCents: order.totalAmount,
      payments: [paymentRow],
    },
  };
}
