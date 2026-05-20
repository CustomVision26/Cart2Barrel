import { relations, sql } from "drizzle-orm";

import type { BatchQuoteSessionStatusEventDetail } from "@/types/batch-quote-history-snapshot";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Account identity & contact (Clerk-linked). Use for billing/legal name and
 * reachability — not for shipping labels (see `addresses`).
 */
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email"),
  fullName: text("full_name"),
  phone: text("phone"),
  profileCompletedAt: timestamp("profile_completed_at", {
    withTimezone: true,
    mode: "string",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const itemRequestStatusEnum = pgEnum("item_request_status", [
  "pending",
  "quoted",
  "approved",
  "rejected",
  "withdrawn",
  "out_of_stock",
]);

/** How the product line entered the system. */
export const itemRequestSourceEnum = pgEnum("item_request_source", [
  "customer_url",
  "outside_purchase",
]);

/** Frozen copies of request line fields for auditing (customer submit + staff estimate saves). */
export const itemRequestLineSnapshotPhaseEnum = pgEnum(
  "item_request_line_snapshot_phase",
  [
    "customer_submission",
    "customer_line_edit",
    "removed_from_cart",
    "pre_admin_estimate_edit",
    "post_admin_estimate_edit",
    /** Customer checkout succeeded; company has not purchased yet. */
    "checkout_paid_pending_delivery",
    /** Admin marked product purchased; awaiting delivery workflow. */
    "company_purchase_pending_delivery",
    /** Frozen line copy bundled with batch estimate (customer-facing totals memo). */
    "batch_estimate_customer_copy",
    /** Frozen line copy bundled with batch estimate (admin-facing totals memo). */
    "batch_estimate_admin_copy",
    /** Product line as sent to staff (batch submitted or revision re-opened). */
    "batch_request_submitted_to_staff",
    /** Staff recorded physical receipt at warehouse (qty, condition, shelf, proof metadata). */
    "warehouse_delivery_received",
    /** Customer requested a product return; pending staff return shipment setup. */
    "product_return_requested",
    /** Staff saved return-to-retailer shipment tracking after a problem receipt. */
    "product_return_tracking_saved",
    /** Customer submitted a refund request; pending staff approval. */
    "customer_refund_request_submitted",
    /** Staff recorded a product the customer bought outside the app and shipped inbound. */
    "outside_purchase_intake",
    /** Staff recorded that the customer was prompted to pay (add to cart). */
    "outside_purchase_payment_prompted",
    /** Customer accepted estimate (service & handling) into cart. */
    "outside_purchase_added_to_cart",
    /** Customer removed outside-purchase line from cart. */
    "outside_purchase_removed_from_cart",
    /** Customer removed line from Active products (withdrawn). */
    "outside_purchase_withdrawn_from_active",
    /** Customer moved withdrawn outside-purchase line back to Active. */
    "outside_purchase_reinstated_to_active",
    /** Customer requested return to retailer for a problem outside-purchase receipt. */
    "outside_purchase_return_requested",
    /** Staff published return service & handling estimate for customer acceptance. */
    "outside_purchase_return_estimate_ready",
    /** Customer accepted return estimate; service & handling due before drop-off. */
    "outside_purchase_return_estimate_accepted",
    /** Customer cancelled an in-progress return-to-retailer request. */
    "outside_purchase_return_cancelled",
    /** Customer paid service & handling at checkout (merchandise bought elsewhere). */
    "outside_purchase_checkout_paid",
  ],
);

export const outsidePurchaseReturnRequestStatusEnum = pgEnum(
  "outside_purchase_return_request_status",
  [
    "submitted",
    "estimate_ready",
    "estimate_accepted",
    "paid",
    "cancelled",
  ],
);

/** Customer grouping of quoted lines for combined staff estimates. */
export const batchQuoteSessionStatusEnum = pgEnum("batch_quote_session_status", [
  "draft",
  "submitted",
  /** Staff saved batch estimate; queue item leaves admin batch tab. */
  "estimated",
  /** Shopper accepted the batch estimate into cart checkout. */
  "in_cart",
  /** Checkout succeeded — ops purchase workflow (mirrors paid order lines). */
  "paid_pending_staff_purchase",
]);

/** Append-only lifecycle log for shopper-visible batch statuses. */
export const batchQuoteSessionStatusEventKindEnum = pgEnum(
  "batch_quote_session_status_event_kind",
  [
    "new_batch_request",
    "quoted_batch",
    "in_cart",
    "paid_pending_staff_purchase",
    "returned_to_quoted_batch",
    "revision_reopened",
  ],
);

export const orderItemFulfillmentEnum = pgEnum("order_item_fulfillment_status", [
  "pending_payment",
  "paid_pending_company_purchase",
  "company_purchase_pending_delivery",
  /** Full line amount was refunded in Stripe; line is closed. */
  "refunded",
  /** Customer or staff confirmed inbound receipt — condition captured on order line. */
  "delivery_received_good_awaiting_barrel",
  /** Staff assigned inbound package to a customer container; awaiting shipment. */
  "in_barrel_awaiting_shipping",
  "delivery_received_item_missing",
  "delivery_received_item_damaged",
  "delivery_received_wrong_item",
  /**
   * Present on some databases (added manually or via older tooling). Listed last so it matches
   * Postgres `ADD VALUE` append order when present after the delivery_received_* labels.
   */
  "delivery_requested_pending_fulfillment",
  /** Return shipment to retailer logged; line awaiting return delivery updates. */
  "product_return_awaiting_delivery",
  /** Outside purchase: customer paid service & handling only at checkout. */
  "paid_outside_purchase_service_fee",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "purchasing",
  "completed",
]);

export const orderItemRefundReasonKindEnum = pgEnum(
  "order_item_refund_reason_kind",
  [
    "defective_or_damaged",
    "wrong_item",
    "not_received",
    "not_as_described",
    "duplicate_charge",
    "changed_mind",
    "other",
  ],
);

export const orderItemRefundRequestStatusEnum = pgEnum(
  "order_item_refund_request_status",
  ["pending_approval", "rejected", "fulfilled"],
);

export const barrelStatusEnum = pgEnum("barrel_status", [
  "filling",
  "ready_to_ship",
  "shipped",
  "delivered",
]);

export const barrelPackageAssignmentActionEnum = pgEnum(
  "barrel_package_assignment_action",
  ["assigned", "reassigned", "removed"],
);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "packed",
  "shipped",
  "in_transit",
  "delivered",
]);

/** Admin catalog: physical container style shown on `/dashboard/barrels`. */
export const containerOfferingKindEnum = pgEnum("container_offering_kind", [
  "barrel",
  "bin",
]);

/** Shipping / delivery destinations (saved labels). Source of truth for where barrels ship. */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    label: text("label"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    cityOrTown: text("city_or_town"),
    parish: text("parish"),
    country: text("country").notNull().default("Jamaica"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("addresses_clerk_user_id_idx").on(t.clerkUserId)],
);

export const batchQuoteSessions = pgTable(
  "batch_quote_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull().unique(),
    /** Canonical grouping key (`canonicalBatchSiteKey`) for mixed-site guards. */
    siteKey: text("site_key").notNull(),
    status: batchQuoteSessionStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", {
      withTimezone: true,
      mode: "string",
    }),
    /** Set when shopper accepts combined batch estimate into cart checkout. */
    cartAcceptanceAcceptedAt: timestamp("cart_acceptance_accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
    /** Estimate row totals locked into cart for this bundle (pricing snapshot). */
    cartAcceptanceAcceptedEstimateId: uuid("cart_acceptance_accepted_estimate_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("batch_quote_sessions_clerk_user_id_created_at_idx").on(
      t.clerkUserId,
      t.createdAt,
    ),
    index("batch_quote_sessions_status_idx").on(t.status),
  ],
);

export const batchQuoteSessionStatusEvents = pgTable(
  "batch_quote_session_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchQuoteSessionId: uuid("batch_quote_session_id")
      .notNull()
      .references(() => batchQuoteSessions.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    kind: batchQuoteSessionStatusEventKindEnum("kind").notNull(),
    detail: jsonb("detail").$type<BatchQuoteSessionStatusEventDetail | null>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("batch_quote_session_status_events_session_id_created_at_idx").on(
      t.batchQuoteSessionId,
      t.createdAt,
    ),
    index("batch_quote_session_status_events_clerk_user_id_created_at_idx").on(
      t.clerkUserId,
      t.createdAt,
    ),
  ],
);

/** User-submitted product links (MVP core). */
export const itemRequests = pgTable(
  "item_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    productUrl: text("product_url").notNull(),
    productName: text("product_name"),
    productSize: text("product_size"),
    productColor: text("product_color"),
    quantity: integer("quantity").notNull().default(1),
    note: text("note"),
    /** Best HTTPS URL for primary product image (e.g. from AI estimate). */
    productImageUrl: text("product_image_url"),
    /** Retailer / site label (AI or hostname from product URL). */
    siteName: text("site_name"),
    status: itemRequestStatusEnum("status").notNull().default("pending"),
    source: itemRequestSourceEnum("source").notNull().default("customer_url"),
    /**
     * Unique staff-facing id for outside-purchase intake (e.g. OP-20260517-A1B2).
     * Set when {@link source} is `outside_purchase`.
     */
    outsidePurchaseReference: text("outside_purchase_reference"),
    /** When staff recorded prompting the customer to pay (outside-purchase lines). */
    outsidePurchasePaymentPromptedAt: timestamp(
      "outside_purchase_payment_prompted_at",
      { withTimezone: true, mode: "string" },
    ),
    /** Proof-of-purchase receipt photo from outside-purchase intake. */
    outsidePurchaseReceiptImageUrl: text("outside_purchase_receipt_image_url"),
    /** Physical condition when staff received the outside-purchase product at the warehouse. */
    outsidePurchaseReceivedCondition: text("outside_purchase_received_condition"),
    /** Warehouse shelf / bin assigned at outside-purchase intake. */
    outsidePurchaseShelfLocation: text("outside_purchase_shelf_location"),
    /** Present while the line sits in Batch Quotes draft/submitted queues. Cleared once staff saves a batch estimate. */
    batchQuoteSessionId: uuid("batch_quote_session_id").references(
      () => batchQuoteSessions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("item_requests_clerk_user_id_created_at_idx").on(
      t.clerkUserId,
      t.createdAt,
    ),
    index("item_requests_batch_quote_session_id_idx").on(t.batchQuoteSessionId),
    uniqueIndex("item_requests_outside_purchase_reference_unique")
      .on(t.outsidePurchaseReference)
      .where(sql`${t.outsidePurchaseReference} is not null`),
  ],
);

/** Customer return-to-retailer workflow for problem outside-purchase intakes. */
export const outsidePurchaseReturnRequests = pgTable(
  "outside_purchase_return_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemRequestId: uuid("item_request_id")
      .notNull()
      .references(() => itemRequests.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    status: outsidePurchaseReturnRequestStatusEnum("status")
      .notNull()
      .default("submitted"),
    /** Retailer return label / receipt image for carrier scan-to-print. */
    returnLabelImageUrl: text("return_label_image_url"),
    returnWindowStart: timestamp("return_window_start", {
      withTimezone: true,
      mode: "string",
    }),
    returnWindowEnd: timestamp("return_window_end", {
      withTimezone: true,
      mode: "string",
    }),
    customerNotes: text("customer_notes"),
    /** Return service & handling fee (USD cents) set by staff before customer accepts. */
    returnServiceFeeCents: integer("return_service_fee_cents"),
    returnStaffNote: text("return_staff_note"),
    estimateReadyAt: timestamp("estimate_ready_at", {
      withTimezone: true,
      mode: "string",
    }),
    estimateAcceptedAt: timestamp("estimate_accepted_at", {
      withTimezone: true,
      mode: "string",
    }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("outside_purchase_return_requests_item_request_id_unique").on(
      t.itemRequestId,
    ),
    index("outside_purchase_return_requests_clerk_user_id_idx").on(t.clerkUserId),
    index("outside_purchase_return_requests_status_idx").on(t.status),
  ],
);

/** Lines attached to a customer batch quote session. */
export const batchQuoteSessionLines = pgTable(
  "batch_quote_session_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchQuoteSessionId: uuid("batch_quote_session_id")
      .notNull()
      .references(() => batchQuoteSessions.id, { onDelete: "cascade" }),
    itemRequestId: uuid("item_request_id")
      .notNull()
      .references(() => itemRequests.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("batch_quote_session_lines_item_request_id_unique").on(
      t.itemRequestId,
    ),
    index("batch_quote_session_lines_batch_session_idx").on(
      t.batchQuoteSessionId,
    ),
  ],
);

/** Staff-produced combined estimate for a batch session (revisions void prior rows). */
export const batchQuoteEstimates = pgTable(
  "batch_quote_estimates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchQuoteSessionId: uuid("batch_quote_session_id")
      .notNull()
      .references(() => batchQuoteSessions.id, { onDelete: "cascade" }),
    batchMerchandiseTotalCents: integer("batch_merchandise_total_cents").notNull(),
    siteMerchandiseTotalCents: integer("site_merchandise_total_cents").notNull(),
    itemDiscountCents: integer("item_discount_cents").notNull(),
    serviceHandlingTotalCents: integer("service_handling_total_cents").notNull(),
    batchShippingTotalCents: integer("batch_shipping_total_cents").notNull(),
    siteShippingTotalCents: integer("site_shipping_total_cents").notNull(),
    shippingDiscountCents: integer("shipping_discount_cents").notNull(),
    batchSaleTaxTotalCents: integer("batch_sale_tax_total_cents").notNull(),
    siteSaleTaxTotalCents: integer("site_sale_tax_total_cents").notNull(),
    saleTaxDiscountCents: integer("sale_tax_discount_cents").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("batch_quote_estimates_session_id_idx").on(t.batchQuoteSessionId)],
);

/** Admin pricing for an item request. */
export const itemQuotes = pgTable(
  "item_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemRequestId: uuid("item_request_id")
      .notNull()
      .references(() => itemRequests.id, { onDelete: "cascade" }),
    /** Amount in smallest currency unit (e.g. cents). */
    itemCost: integer("item_cost").notNull(),
    /**
     * Instant savings / promo deduction from the listed pack–bundle subtotal (estimate).
     * Merchandise subtotal saved as `itemCost` is net; optional line in quote preview when set.
     */
    merchandiseSavingsCents: integer("merchandise_savings_cents"),
    serviceFee: integer("service_fee").notNull(),
    /** Flat packing once per quoted line (cents); included in `totalPrice`. */
    packingFeeCents: integer("packing_fee_cents").notNull().default(0),
    estimatedShipping: integer("estimated_shipping").notNull(),
    totalPrice: integer("total_price").notNull(),
    /**
     * When set, this row is kept for history only; `getLatestQuoteForItemRequest`
     * ignores it. New estimates insert a fresh row instead of deleting.
     */
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "string" }),
    /**
     * Set when voided. Customer resend rows are hidden from admin Quote history;
     * staff replacements remain visible as superseded.
     */
    voidReason: text("void_reason"),
    /** Snapshot of the customer request line at the time this estimate was saved. */
    requestQuantity: integer("request_quantity"),
    requestProductSize: text("request_product_size"),
    requestProductColor: text("request_product_color"),
    requestProductName: text("request_product_name"),
    /**
     * When true, staff recorded that the retailer’s listed line price already bundles
     * site shipping & sale tax into merchandise; `estimated_shipping` / implicit tax stay $0.
     */
    merchandiseIncludesSiteShippingTax: boolean(
      "merchandise_includes_site_shipping_tax",
    )
      .notNull()
      .default(false),
    /**
     * Admin note on this estimate (charge explanation, product conditions). Shown on quote history.
     */
    staffNote: text("staff_note"),
    /**
     * System timeline copies (not staff estimates). Excluded from cart / latest-quote logic.
     * Values: `paid` (customer paid), `company_purchase` (admin confirmed purchase).
     */
    checkoutSnapshotKind: text("checkout_snapshot_kind"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("item_quotes_item_request_id_idx").on(t.itemRequestId)],
);

export const itemRequestLineSnapshots = pgTable(
  "item_request_line_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemRequestId: uuid("item_request_id")
      .notNull()
      .references(() => itemRequests.id, { onDelete: "cascade" }),
    /**
     * When phase is post_admin_estimate_edit, links to the quote row created in the same save.
     */
    itemQuoteId: uuid("item_quote_id").references(() => itemQuotes.id, {
      onDelete: "set null",
    }),
    phase: itemRequestLineSnapshotPhaseEnum("phase").notNull(),
    batchQuoteSessionId: uuid("batch_quote_session_id").references(
      () => batchQuoteSessions.id,
      { onDelete: "set null" },
    ),
    /** Batch estimate totals memo (Markdown/plain); preserves customer-facing request note untouched. */
    auditMemo: text("audit_memo"),
    productUrl: text("product_url").notNull(),
    productName: text("product_name"),
    productSize: text("product_size"),
    productColor: text("product_color"),
    quantity: integer("quantity").notNull(),
    note: text("note"),
    productImageUrl: text("product_image_url"),
    siteName: text("site_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("item_request_line_snapshots_item_request_id_created_at_idx").on(
      t.itemRequestId,
      t.createdAt,
    ),
  ],
);

/** Order after user approves quotes and pays. */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    /** Total charged, smallest currency unit. */
    totalAmount: integer("total_amount").notNull(),
    /** Stripe Checkout Session id while status is pending (released when paid or expired). */
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    /**
     * Sum of staff-quoted retailer/site sale tax intent (USD cents), stored when the checkout
     * order is created — see `buildStripeLineItemsFromAssembledCart` /
     * `quotedSalesTaxIntentCents`.
     */
    internalQuotedSaleTaxCents: integer("internal_quoted_sale_tax_cents"),
    /**
     * Stripe Checkout `total_details.amount_tax` (USD cents) captured when payment completes —
     * Stripe’s view of tax on the session (may differ from quoted amounts).
     */
    stripeTotalDetailsTaxCents: integer("stripe_total_details_tax_cents"),
    /**
     * Stripe processing fee from the payment’s BalanceTransaction (USD cents); null if not
     * fetched or unavailable.
     */
    stripeFeeCents: integer("stripe_fee_cents"),
    /** Set after the paid-order receipt email is sent successfully (idempotency). */
    receiptEmailSentAt: timestamp("receipt_email_sent_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("orders_clerk_user_id_created_at_idx").on(t.clerkUserId, t.createdAt),
    uniqueIndex("orders_stripe_payment_intent_id_unique").on(
      t.stripePaymentIntentId,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemRequestId: uuid("item_request_id")
      .notNull()
      .references(() => itemRequests.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    /** Line price, smallest currency unit. */
    price: integer("price").notNull(),
    fulfillmentStatus: orderItemFulfillmentEnum("fulfillment_status")
      .notNull()
      .default("pending_payment"),
    /** Tracking URL pasted when admin confirms retailer purchase (shipping portal link). */
    companyPurchaseTrackingUrl: text("company_purchase_tracking_url"),
    /** Carrier / retailer name for the tracking number below (optional pair with number). */
    companyPurchaseRetailerTrackingCompany: text(
      "company_purchase_retailer_tracking_company",
    ),
    companyPurchaseRetailerTrackingNumber: text(
      "company_purchase_retailer_tracking_number",
    ),
    /** Retailer invoice / order confirmation screenshots stored as public blob URLs. */
    companyPurchaseReceiptImageUrls: jsonb(
      "company_purchase_receipt_image_urls",
    ).$type<string[] | null>(),
    warehouseReceivedAt: timestamp("warehouse_received_at", {
      withTimezone: true,
      mode: "string",
    }),
    warehouseReceivedQty: integer("warehouse_received_qty"),
    warehouseReceivedCondition: text("warehouse_received_condition"),
    warehouseShelfLocation: text("warehouse_shelf_location"),
    warehouseReceivedBarcode: text("warehouse_received_barcode"),
    /** Photo of the package / SKU barcode stored as a public Vercel Blob URL. */
    warehouseReceivedBarcodeImageUrl: text(
      "warehouse_received_barcode_image_url",
    ),
    warehouseReceivedProofPhotoCount: integer(
      "warehouse_received_proof_photo_count",
    ),
    /** Intake / receiving proof photos (package condition, labels) as public blob URLs. */
    warehouseReceivedProofPhotoUrls: jsonb(
      "warehouse_received_proof_photo_urls",
    ).$type<string[] | null>(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_item_request_id_idx").on(t.itemRequestId),
    uniqueIndex("order_items_order_id_item_request_id_unique").on(
      t.orderId,
      t.itemRequestId,
    ),
  ],
);

/** Stripe refunds applied to a single order line (partial or full). */
export const orderItemRefunds = pgTable(
  "order_item_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    /** Amount refunded via Stripe for this row, smallest currency unit (USD cents). */
    amountCents: integer("amount_cents").notNull(),
    stripeRefundId: text("stripe_refund_id").notNull().unique(),
    reason: text("reason"),
    createdByClerkUserId: text("created_by_clerk_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("order_item_refunds_order_item_id_idx").on(t.orderItemId),
  ],
);

export const orderItemProductReturnRequestStatusEnum = pgEnum(
  "order_item_product_return_request_status",
  ["submitted", "fulfilled", "cancelled"],
);

export const orderItemProductReturnDesiredOutcomeEnum = pgEnum(
  "order_item_product_return_desired_outcome",
  ["money_back", "replacement"],
);

/** Customer-initiated return-to-retailer request; staff records return tracking and receipt. */
export const orderItemProductReturnRequests = pgTable(
  "order_item_product_return_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    desiredOutcome: orderItemProductReturnDesiredOutcomeEnum("desired_outcome"),
    reasonKind: orderItemRefundReasonKindEnum("reason_kind").notNull(),
    details: text("details").notNull(),
    returnWindowStart: timestamp("return_window_start", {
      withTimezone: true,
      mode: "string",
    }),
    returnWindowEnd: timestamp("return_window_end", {
      withTimezone: true,
      mode: "string",
    }),
    customerNotes: text("customer_notes"),
    status: orderItemProductReturnRequestStatusEnum("status")
      .notNull()
      .default("submitted"),
    fulfilledAt: timestamp("fulfilled_at", {
      withTimezone: true,
      mode: "string",
    }),
    fulfilledByClerkUserId: text("fulfilled_by_clerk_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("order_item_product_return_requests_order_item_id_unique").on(
      t.orderItemId,
    ),
    index("order_item_product_return_requests_clerk_user_id_idx").on(
      t.clerkUserId,
    ),
    index("order_item_product_return_requests_status_idx").on(t.status),
  ],
);

/** Customer-initiated refund request; staff approves before Stripe refund. */
export const orderItemRefundRequests = pgTable(
  "order_item_refund_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    /** Order owner (Clerk subject) submitting the request. */
    clerkUserId: text("clerk_user_id").notNull(),
    reasonKind: orderItemRefundReasonKindEnum("reason_kind").notNull(),
    details: text("details").notNull(),
    /**
     * Requested refundable merchandise line total (USD cents), capped on approval.
     * Null means customer asked for full remaining refundable amount on the line.
     */
    requestedAmountCents: integer("requested_amount_cents"),
    status: orderItemRefundRequestStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
    rejectionNote: text("rejection_note"),
    fulfilledStripeRefundId: text("fulfilled_stripe_refund_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("order_item_refund_requests_order_item_id_idx").on(t.orderItemId),
    index("order_item_refund_requests_status_idx").on(t.status),
  ],
);

/** Admin-triggered delivery coordination for a paid order line (email + audit row). */
export const deliveryRequests = pgTable(
  "delivery_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    requestedByClerkUserId: text("requested_by_clerk_user_id").notNull(),
    /** Comma-separated destinations used for the ops notification attempt. */
    opsDestinations: text("ops_destinations").notNull(),
    /** Customer profile/email used for optional shopper confirmation (if any). */
    customerEmailAttempted: text("customer_email_attempted"),
    notifiedOpsAt: timestamp("notified_ops_at", {
      withTimezone: true,
      mode: "string",
    }),
    notifiedCustomerAt: timestamp("notified_customer_at", {
      withTimezone: true,
      mode: "string",
    }),
    notifyErrors: text("notify_errors"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("delivery_requests_order_item_id_idx").on(t.orderItemId),
    index("delivery_requests_created_at_idx").on(t.createdAt),
  ],
);

/** Singleton row: flat packing + container shipping fees (cents). */
export const merchantPackingFeeSettings = pgTable("merchant_packing_fee_settings", {
  singletonKey: text("singleton_key").primaryKey().default("default"),
  packingFeePerLineCents: integer("packing_fee_per_line_cents").notNull().default(0),
  /** Exactly one barrel in cart (cents). */
  barrelShippingFeeCents: integer("barrel_shipping_fee_cents").notNull().default(10_000),
  /** Exactly one bin in cart (cents). */
  binShippingFeeCents: integer("bin_shipping_fee_cents").notNull().default(5_500),
  /** Per barrel when cart has 2+ barrels (cents). */
  multiBarrelPackingPerUnitCents: integer("multi_barrel_packing_per_unit_cents")
    .notNull()
    .default(8_000),
  /** Per bin when cart has 2+ bins (cents). */
  multiBinPackingPerUnitCents: integer("multi_bin_packing_per_unit_cents")
    .notNull()
    .default(4_500),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

/**
 * Manual total packing/shipping fee (cents) for a cart mix of barrel vs bin container counts.
 * Lookup: exact match on (barrel_count, bin_count) after summing quantities by offering kind.
 */
export const merchantPackingComboFees = pgTable(
  "merchant_packing_combo_fees",
  {
    id: serial("id").primaryKey(),
    barrelCount: integer("barrel_count").notNull(),
    binCount: integer("bin_count").notNull(),
    feeCents: integer("fee_cents").notNull(),
    sortIndex: integer("sort_index").notNull(),
  },
  (t) => [
    uniqueIndex("merchant_packing_combo_fees_barrel_bin_uidx").on(
      t.barrelCount,
      t.binCount,
    ),
    uniqueIndex("merchant_packing_combo_fees_sort_uidx").on(t.sortIndex),
  ],
);

/** Per-customer fee package (overrides global merchant pricing when present). */
export const customerPricingPackages = pgTable("customer_pricing_packages", {
  clerkUserId: text("clerk_user_id")
    .primaryKey()
    .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
  /** Optional staff label, e.g. "VIP account". */
  label: text("label"),
  packingFeePerLineCents: integer("packing_fee_per_line_cents").notNull().default(0),
  singleBarrelPackingFeeCents: integer("single_barrel_packing_fee_cents")
    .notNull()
    .default(10_000),
  multiBarrelPackingPerUnitCents: integer("multi_barrel_packing_per_unit_cents")
    .notNull()
    .default(8_000),
  singleBinPackingFeeCents: integer("single_bin_packing_fee_cents")
    .notNull()
    .default(5_500),
  multiBinPackingPerUnitCents: integer("multi_bin_packing_per_unit_cents")
    .notNull()
    .default(4_500),
  /**
   * When set, replaces global service & handling tiers for this customer.
   * Sorted ascending by `maxUnitPriceInclusiveCents`.
   */
  serviceTiersJson: jsonb("service_tiers_json").$type<
    { maxUnitPriceInclusiveCents: number; feePerUnitCents: number }[] | null
  >(),
  updatedByClerkUserId: text("updated_by_clerk_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

/**
 * Staff-applied container packing fee snapshot for a shopper cart (barrel/bin qty + cents).
 * Cart checkout uses this when counts still match; otherwise recomputes from package rates.
 */
export const userCartContainerPackingFees = pgTable(
  "user_cart_container_packing_fees",
  {
    clerkUserId: text("clerk_user_id")
      .primaryKey()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    barrelCount: integer("barrel_count").notNull().default(0),
    binCount: integer("bin_count").notNull().default(0),
    barrelPackingFeeCents: integer("barrel_packing_fee_cents").notNull().default(0),
    binPackingFeeCents: integer("bin_packing_fee_cents").notNull().default(0),
    totalPackingFeeCents: integer("total_packing_fee_cents").notNull().default(0),
    appliedByClerkUserId: text("applied_by_clerk_user_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
);

/**
 * Tiered service & handling: applies when consumer unit price (cents) is at most
 * `maxUnitPriceInclusiveCents` (rows sorted ascending by that bound).
 */
export const serviceHandlingFeeTiers = pgTable(
  "service_handling_fee_tiers",
  {
    id: serial("id").primaryKey(),
    maxUnitPriceInclusiveCents: integer("max_unit_price_inclusive_cents").notNull(),
    feePerUnitCents: integer("fee_per_unit_cents").notNull(),
    sortIndex: integer("sort_index").notNull(),
  },
  (t) => [
    uniqueIndex("service_handling_fee_tiers_sort_idx").on(t.sortIndex),
  ],
);

/** Inbound package to ops (linked to a paid line item). */
export const packages = pgTable(
  "packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    trackingNumber: text("tracking_number"),
    received: boolean("received").notNull().default(false),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("packages_order_item_id_idx").on(t.orderItemId)],
);

/** User’s barrel inventory / fulfillment unit. */
export const barrels = pgTable(
  "barrels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    status: barrelStatusEnum("status").notNull().default("filling"),
    capacityPercentage: integer("capacity_percentage").notNull().default(0),
    /**
     * When this row was provisioned from a paid container checkout line, links back to that
     * snapshot so the shopper UI can show which purchased container slot this physical barrel is.
     */
    orderContainerItemId: uuid("order_container_item_id").references(
      () => orderContainerItems.id,
      { onDelete: "set null" },
    ),
    /** 1-based index within the purchased quantity for that `order_container_items` row. */
    unitOrdinal: integer("unit_ordinal").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("barrels_clerk_user_id_idx").on(t.clerkUserId),
    index("barrels_order_container_item_id_idx").on(t.orderContainerItemId),
  ],
);

export const barrelItems = pgTable(
  "barrel_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    barrelId: uuid("barrel_id")
      .notNull()
      .references(() => barrels.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("barrel_items_barrel_id_idx").on(t.barrelId),
    uniqueIndex("barrel_items_package_id_unique").on(t.packageId),
  ],
);

/** Append-only audit of shopper / staff moves of inbound packages into physical barrels. */
export const barrelPackageAssignmentEvents = pgTable(
  "barrel_package_assignment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerClerkUserId: text("owner_clerk_user_id").notNull(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    fromBarrelId: uuid("from_barrel_id").references(() => barrels.id, {
      onDelete: "set null",
    }),
    toBarrelId: uuid("to_barrel_id").references(() => barrels.id, {
      onDelete: "set null",
    }),
    action: barrelPackageAssignmentActionEnum("action").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    adminNote: text("admin_note"),
    productNameSnapshot: text("product_name_snapshot"),
    barrelLabelSnapshot: text("barrel_label_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("barrel_pkg_assign_events_owner_created_idx").on(
      t.ownerClerkUserId,
      t.createdAt,
    ),
    index("barrel_pkg_assign_events_package_idx").on(t.packageId),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    barrelId: uuid("barrel_id")
      .notNull()
      .references(() => barrels.id, { onDelete: "cascade" }),
    shippingCost: integer("shipping_cost").notNull(),
    trackingNumber: text("tracking_number"),
    status: shipmentStatusEnum("status").notNull().default("packed"),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "string" }),
    deliveredAt: timestamp("delivered_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("shipments_barrel_id_idx").on(t.barrelId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    status: text("status").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("payments_clerk_user_id_created_at_idx").on(t.clerkUserId, t.createdAt),
    index("payments_order_id_idx").on(t.orderId),
    index("payments_shipment_id_idx").on(t.shipmentId),
    check(
      "payments_order_or_shipment_ck",
      sql`${t.orderId} IS NOT NULL OR ${t.shipmentId} IS NOT NULL`,
    ),
  ],
);

/**
 * Admin-managed shipping container / barrel SKUs shown on the shopper catalog (`/dashboard/barrels`).
 */
export const containerOfferings = pgTable(
  "container_offerings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sizeLabel: text("size_label").notNull(),
    kind: containerOfferingKindEnum("kind").notNull().default("barrel"),
    priceUsdCents: integer("price_usd_cents").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortIndex: integer("sort_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("container_offerings_active_sort_idx").on(t.isActive, t.sortIndex),
  ],
);

export const containerOfferingImages = pgTable(
  "container_offering_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    containerOfferingId: uuid("container_offering_id")
      .notNull()
      .references(() => containerOfferings.id, { onDelete: "cascade" }),
    imageUrl: text("image_url").notNull(),
    sortIndex: integer("sort_index").notNull().default(0),
  },
  (t) => [
    index("container_offering_images_offering_id_idx").on(t.containerOfferingId),
  ],
);

/** Shopper staging for container SKUs before checkout (cleared when a pending order reserves them). */
export const userContainerCartLines = pgTable(
  "user_container_cart_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id")
      .notNull()
      .references(() => profiles.clerkUserId, { onDelete: "cascade" }),
    containerOfferingId: uuid("container_offering_id")
      .notNull()
      .references(() => containerOfferings.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_container_cart_lines_user_offering_unique").on(
      t.clerkUserId,
      t.containerOfferingId,
    ),
    index("user_container_cart_lines_clerk_user_id_idx").on(t.clerkUserId),
  ],
);

/** Paid / pending-checkout snapshot of container lines (restored to user cart if pending order is released). */
export const orderContainerItems = pgTable(
  "order_container_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    containerOfferingId: uuid("container_offering_id").references(
      () => containerOfferings.id,
      { onDelete: "set null" },
    ),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    sizeSnapshot: text("size_snapshot").notNull(),
    /** `barrel` | `bin` at checkout (matches `container_offering_kind`). */
    kindSnapshot: text("kind_snapshot").notNull().default("barrel"),
  },
  (t) => [index("order_container_items_order_id_idx").on(t.orderId)],
);

/* --- Relations (db.query graph) --- */

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  addresses: many(addresses),
  batchQuoteSessions: many(batchQuoteSessions),
  itemRequests: many(itemRequests),
  orders: many(orders),
  barrels: many(barrels),
  payments: many(payments),
  containerCartLines: many(userContainerCartLines),
  pricingPackage: one(customerPricingPackages, {
    fields: [profiles.clerkUserId],
    references: [customerPricingPackages.clerkUserId],
  }),
  cartContainerPackingFees: one(userCartContainerPackingFees, {
    fields: [profiles.clerkUserId],
    references: [userCartContainerPackingFees.clerkUserId],
  }),
}));

export const customerPricingPackagesRelations = relations(
  customerPricingPackages,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [customerPricingPackages.clerkUserId],
      references: [profiles.clerkUserId],
    }),
  }),
);

export const userCartContainerPackingFeesRelations = relations(
  userCartContainerPackingFees,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [userCartContainerPackingFees.clerkUserId],
      references: [profiles.clerkUserId],
    }),
  }),
);

export const addressesRelations = relations(addresses, ({ one }) => ({
  profile: one(profiles, {
    fields: [addresses.clerkUserId],
    references: [profiles.clerkUserId],
  }),
}));

export const batchQuoteSessionsRelations = relations(
  batchQuoteSessions,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [batchQuoteSessions.clerkUserId],
      references: [profiles.clerkUserId],
    }),
    lines: many(batchQuoteSessionLines),
    estimates: many(batchQuoteEstimates),
    cartAcceptedEstimate: one(batchQuoteEstimates, {
      fields: [batchQuoteSessions.cartAcceptanceAcceptedEstimateId],
      references: [batchQuoteEstimates.id],
    }),
    statusEvents: many(batchQuoteSessionStatusEvents),
  }),
);

export const batchQuoteSessionStatusEventsRelations = relations(
  batchQuoteSessionStatusEvents,
  ({ one }) => ({
    session: one(batchQuoteSessions, {
      fields: [batchQuoteSessionStatusEvents.batchQuoteSessionId],
      references: [batchQuoteSessions.id],
    }),
  }),
);

export const batchQuoteSessionLinesRelations = relations(
  batchQuoteSessionLines,
  ({ one }) => ({
    session: one(batchQuoteSessions, {
      fields: [batchQuoteSessionLines.batchQuoteSessionId],
      references: [batchQuoteSessions.id],
    }),
    itemRequest: one(itemRequests, {
      fields: [batchQuoteSessionLines.itemRequestId],
      references: [itemRequests.id],
    }),
  }),
);

export const batchQuoteEstimatesRelations = relations(
  batchQuoteEstimates,
  ({ one }) => ({
    session: one(batchQuoteSessions, {
      fields: [batchQuoteEstimates.batchQuoteSessionId],
      references: [batchQuoteSessions.id],
    }),
  }),
);

export const itemRequestsRelations = relations(itemRequests, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [itemRequests.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  batchQuoteSession: one(batchQuoteSessions, {
    fields: [itemRequests.batchQuoteSessionId],
    references: [batchQuoteSessions.id],
  }),
  quotes: many(itemQuotes),
  lineSnapshots: many(itemRequestLineSnapshots),
  orderItems: many(orderItems),
  outsidePurchaseReturnRequest: one(outsidePurchaseReturnRequests),
}));

export const outsidePurchaseReturnRequestsRelations = relations(
  outsidePurchaseReturnRequests,
  ({ one }) => ({
    itemRequest: one(itemRequests, {
      fields: [outsidePurchaseReturnRequests.itemRequestId],
      references: [itemRequests.id],
    }),
  }),
);

export const itemQuotesRelations = relations(itemQuotes, ({ one, many }) => ({
  itemRequest: one(itemRequests, {
    fields: [itemQuotes.itemRequestId],
    references: [itemRequests.id],
  }),
  lineSnapshots: many(itemRequestLineSnapshots),
}));

export const itemRequestLineSnapshotsRelations = relations(
  itemRequestLineSnapshots,
  ({ one }) => ({
    itemRequest: one(itemRequests, {
      fields: [itemRequestLineSnapshots.itemRequestId],
      references: [itemRequests.id],
    }),
    itemQuote: one(itemQuotes, {
      fields: [itemRequestLineSnapshots.itemQuoteId],
      references: [itemQuotes.id],
    }),
    batchQuoteSession: one(batchQuoteSessions, {
      fields: [itemRequestLineSnapshots.batchQuoteSessionId],
      references: [batchQuoteSessions.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [orders.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  items: many(orderItems),
  payments: many(payments),
  containerItems: many(orderContainerItems),
}));

export const containerOfferingsRelations = relations(
  containerOfferings,
  ({ many }) => ({
    images: many(containerOfferingImages),
    cartLines: many(userContainerCartLines),
    orderItems: many(orderContainerItems),
  }),
);

export const containerOfferingImagesRelations = relations(
  containerOfferingImages,
  ({ one }) => ({
    offering: one(containerOfferings, {
      fields: [containerOfferingImages.containerOfferingId],
      references: [containerOfferings.id],
    }),
  }),
);

export const userContainerCartLinesRelations = relations(
  userContainerCartLines,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [userContainerCartLines.clerkUserId],
      references: [profiles.clerkUserId],
    }),
    offering: one(containerOfferings, {
      fields: [userContainerCartLines.containerOfferingId],
      references: [containerOfferings.id],
    }),
  }),
);

export const orderContainerItemsRelations = relations(
  orderContainerItems,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [orderContainerItems.orderId],
      references: [orders.id],
    }),
    offering: one(containerOfferings, {
      fields: [orderContainerItems.containerOfferingId],
      references: [containerOfferings.id],
    }),
    provisionedBarrels: many(barrels),
  }),
);

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  itemRequest: one(itemRequests, {
    fields: [orderItems.itemRequestId],
    references: [itemRequests.id],
  }),
  packages: many(packages),
  deliveryRequests: many(deliveryRequests),
  refunds: many(orderItemRefunds),
  refundRequests: many(orderItemRefundRequests),
  productReturnRequest: one(orderItemProductReturnRequests),
  barrelAssignmentEvents: many(barrelPackageAssignmentEvents),
}));

export const orderItemProductReturnRequestsRelations = relations(
  orderItemProductReturnRequests,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemProductReturnRequests.orderItemId],
      references: [orderItems.id],
    }),
  }),
);

export const orderItemRefundRequestsRelations = relations(
  orderItemRefundRequests,
  ({ one }) => ({
    orderItem: one(orderItems, {
      fields: [orderItemRefundRequests.orderItemId],
      references: [orderItems.id],
    }),
  }),
);

export const orderItemRefundsRelations = relations(orderItemRefunds, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemRefunds.orderItemId],
    references: [orderItems.id],
  }),
}));

export const deliveryRequestsRelations = relations(deliveryRequests, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [deliveryRequests.orderItemId],
    references: [orderItems.id],
  }),
}));

export const packagesRelations = relations(packages, ({ one, many }) => ({
  orderItem: one(orderItems, {
    fields: [packages.orderItemId],
    references: [orderItems.id],
  }),
  barrelItems: many(barrelItems),
  assignmentEvents: many(barrelPackageAssignmentEvents),
}));

export const barrelsRelations = relations(barrels, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [barrels.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  orderContainerItem: one(orderContainerItems, {
    fields: [barrels.orderContainerItemId],
    references: [orderContainerItems.id],
  }),
  barrelItems: many(barrelItems),
  shipments: many(shipments),
}));

export const barrelItemsRelations = relations(barrelItems, ({ one }) => ({
  barrel: one(barrels, {
    fields: [barrelItems.barrelId],
    references: [barrels.id],
  }),
  inboundPackage: one(packages, {
    fields: [barrelItems.packageId],
    references: [packages.id],
  }),
}));

export const barrelPackageAssignmentEventsRelations = relations(
  barrelPackageAssignmentEvents,
  ({ one }) => ({
    inboundPackage: one(packages, {
      fields: [barrelPackageAssignmentEvents.packageId],
      references: [packages.id],
    }),
    orderItem: one(orderItems, {
      fields: [barrelPackageAssignmentEvents.orderItemId],
      references: [orderItems.id],
    }),
  }),
);

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  barrel: one(barrels, {
    fields: [shipments.barrelId],
    references: [barrels.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  profile: one(profiles, {
    fields: [payments.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  shipment: one(shipments, {
    fields: [payments.shipmentId],
    references: [shipments.id],
  }),
}));

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type CustomerPricingPackage = typeof customerPricingPackages.$inferSelect;
export type NewCustomerPricingPackage =
  typeof customerPricingPackages.$inferInsert;
export type UserCartContainerPackingFees =
  typeof userCartContainerPackingFees.$inferSelect;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type ItemRequest = typeof itemRequests.$inferSelect;
export type NewItemRequest = typeof itemRequests.$inferInsert;

export type OutsidePurchaseReturnRequest =
  typeof outsidePurchaseReturnRequests.$inferSelect;
export type NewOutsidePurchaseReturnRequest =
  typeof outsidePurchaseReturnRequests.$inferInsert;

export type ItemQuote = typeof itemQuotes.$inferSelect;
export type NewItemQuote = typeof itemQuotes.$inferInsert;

export type ItemRequestLineSnapshot = typeof itemRequestLineSnapshots.$inferSelect;
export type NewItemRequestLineSnapshot =
  typeof itemRequestLineSnapshots.$inferInsert;

export type BatchQuoteSession = typeof batchQuoteSessions.$inferSelect;
export type NewBatchQuoteSession = typeof batchQuoteSessions.$inferInsert;

export type BatchQuoteSessionLine = typeof batchQuoteSessionLines.$inferSelect;
export type NewBatchQuoteSessionLine =
  typeof batchQuoteSessionLines.$inferInsert;

export type BatchQuoteEstimate = typeof batchQuoteEstimates.$inferSelect;
export type NewBatchQuoteEstimate = typeof batchQuoteEstimates.$inferInsert;

export type BatchQuoteSessionStatusEvent =
  typeof batchQuoteSessionStatusEvents.$inferSelect;
export type BatchQuoteSessionEventKind =
  BatchQuoteSessionStatusEvent["kind"];

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderItemRefund = typeof orderItemRefunds.$inferSelect;
export type NewOrderItemRefund = typeof orderItemRefunds.$inferInsert;

export type OrderItemRefundRequest = typeof orderItemRefundRequests.$inferSelect;
export type NewOrderItemRefundRequest = typeof orderItemRefundRequests.$inferInsert;

export type OrderItemProductReturnRequest =
  typeof orderItemProductReturnRequests.$inferSelect;
export type NewOrderItemProductReturnRequest =
  typeof orderItemProductReturnRequests.$inferInsert;

export type DeliveryRequest = typeof deliveryRequests.$inferSelect;
export type NewDeliveryRequest = typeof deliveryRequests.$inferInsert;

export type MerchantPackingFeeSetting = typeof merchantPackingFeeSettings.$inferSelect;
export type NewMerchantPackingFeeSetting = typeof merchantPackingFeeSettings.$inferInsert;
export type MerchantPackingComboFee = typeof merchantPackingComboFees.$inferSelect;
export type NewMerchantPackingComboFee = typeof merchantPackingComboFees.$inferInsert;

export type ServiceHandlingFeeTier = typeof serviceHandlingFeeTiers.$inferSelect;
export type NewServiceHandlingFeeTier = typeof serviceHandlingFeeTiers.$inferInsert;

export type Package = typeof packages.$inferSelect;
export type NewPackage = typeof packages.$inferInsert;

export type Barrel = typeof barrels.$inferSelect;
export type NewBarrel = typeof barrels.$inferInsert;

export type BarrelItem = typeof barrelItems.$inferSelect;
export type NewBarrelItem = typeof barrelItems.$inferInsert;

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type ContainerOffering = typeof containerOfferings.$inferSelect;
export type NewContainerOffering = typeof containerOfferings.$inferInsert;

export type ContainerOfferingImage = typeof containerOfferingImages.$inferSelect;
export type NewContainerOfferingImage =
  typeof containerOfferingImages.$inferInsert;

export type UserContainerCartLine = typeof userContainerCartLines.$inferSelect;
export type NewUserContainerCartLine = typeof userContainerCartLines.$inferInsert;

export type BarrelPackageAssignmentEvent =
  typeof barrelPackageAssignmentEvents.$inferSelect;
export type NewBarrelPackageAssignmentEvent =
  typeof barrelPackageAssignmentEvents.$inferInsert;

export type OrderContainerItem = typeof orderContainerItems.$inferSelect;
export type NewOrderContainerItem = typeof orderContainerItems.$inferInsert;
