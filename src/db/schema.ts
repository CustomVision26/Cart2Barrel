import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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
  ],
);

export const orderItemFulfillmentEnum = pgEnum("order_item_fulfillment_status", [
  "pending_payment",
  "paid_pending_company_purchase",
  "company_purchase_pending_delivery",
  /** Full line amount was refunded in Stripe; line is closed. */
  "refunded",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "purchasing",
  "completed",
]);

export const barrelStatusEnum = pgEnum("barrel_status", [
  "filling",
  "ready_to_ship",
  "shipped",
  "delivered",
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "packed",
  "shipped",
  "in_transit",
  "delivered",
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("item_requests_clerk_user_id_created_at_idx").on(
      t.clerkUserId,
      t.createdAt,
    ),
  ],
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
    serviceFee: integer("service_fee").notNull(),
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
    stripePaymentIntentId: text("stripe_payment_intent_id"),
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
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("barrels_clerk_user_id_idx").on(t.clerkUserId)],
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

/* --- Relations (db.query graph) --- */

export const profilesRelations = relations(profiles, ({ many }) => ({
  addresses: many(addresses),
  itemRequests: many(itemRequests),
  orders: many(orders),
  barrels: many(barrels),
  payments: many(payments),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  profile: one(profiles, {
    fields: [addresses.clerkUserId],
    references: [profiles.clerkUserId],
  }),
}));

export const itemRequestsRelations = relations(itemRequests, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [itemRequests.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  quotes: many(itemQuotes),
  lineSnapshots: many(itemRequestLineSnapshots),
  orderItems: many(orderItems),
}));

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
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [orders.clerkUserId],
    references: [profiles.clerkUserId],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

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
}));

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
}));

export const barrelsRelations = relations(barrels, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [barrels.clerkUserId],
    references: [profiles.clerkUserId],
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

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type ItemRequest = typeof itemRequests.$inferSelect;
export type NewItemRequest = typeof itemRequests.$inferInsert;

export type ItemQuote = typeof itemQuotes.$inferSelect;
export type NewItemQuote = typeof itemQuotes.$inferInsert;

export type ItemRequestLineSnapshot = typeof itemRequestLineSnapshots.$inferSelect;
export type NewItemRequestLineSnapshot =
  typeof itemRequestLineSnapshots.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderItemRefund = typeof orderItemRefunds.$inferSelect;
export type NewOrderItemRefund = typeof orderItemRefunds.$inferInsert;

export type DeliveryRequest = typeof deliveryRequests.$inferSelect;
export type NewDeliveryRequest = typeof deliveryRequests.$inferInsert;

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
