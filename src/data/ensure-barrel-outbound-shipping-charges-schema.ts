import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;

/**
 * Creates outbound shipping charge tables when missing.
 * Idempotent until `npm run db:push` / migrate has run.
 */
export async function ensureBarrelOutboundShippingChargesSchema(): Promise<boolean> {
  if (schemaReady) {
    return true;
  }

  const db = getDb();
  try {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."barrel_outbound_shipping_charge_kind" AS ENUM(
          'freight',
          'broker',
          'courier'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_charges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barrel_id" uuid NOT NULL,
        "clerk_user_id" text NOT NULL,
        "charge_kind" "barrel_outbound_shipping_charge_kind" DEFAULT 'freight' NOT NULL,
        "partner_name" text,
        "partner_location" text,
        "partner_address" text,
        "partner_country" text,
        "admin_note" text,
        "paid_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_charge_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "charge_id" uuid NOT NULL,
        "label" text NOT NULL,
        "amount_cents" integer NOT NULL,
        "sort_index" integer DEFAULT 0 NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_outbound_shipping_cart_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "clerk_user_id" text NOT NULL,
        "charge_id" uuid NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charges"
          ADD CONSTRAINT "barrel_outbound_shipping_charges_barrel_id_barrels_id_fk"
          FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charges"
          ADD CONSTRAINT "barrel_outbound_shipping_charges_clerk_user_id_profiles_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_charge_lines"
          ADD CONSTRAINT "barrel_outbound_shipping_charge_lines_charge_id_fk"
          FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "user_outbound_shipping_cart_lines"
          ADD CONSTRAINT "user_outbound_shipping_cart_lines_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "user_outbound_shipping_cart_lines"
          ADD CONSTRAINT "user_outbound_shipping_cart_lines_charge_id_fk"
          FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DROP INDEX IF EXISTS "barrel_outbound_shipping_charges_barrel_unique"
    `);

    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "charge_kind" "barrel_outbound_shipping_charge_kind" DEFAULT 'freight' NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_name" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_location" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_address" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_country" text
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_barrel_kind_uidx"
      ON "barrel_outbound_shipping_charges" USING btree ("barrel_id", "charge_kind")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_charges_clerk_user_id_idx"
      ON "barrel_outbound_shipping_charges" USING btree ("clerk_user_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_charge_lines_charge_id_idx"
      ON "barrel_outbound_shipping_charge_lines" USING btree ("charge_id")
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_outbound_shipping_cart_lines_user_charge_unique"
      ON "user_outbound_shipping_cart_lines" USING btree ("clerk_user_id", "charge_id")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_partners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barrel_id" uuid NOT NULL,
        "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL,
        "name" text NOT NULL,
        "location" text,
        "address" text,
        "country" text,
        "is_primary" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "barrel_outbound_shipping_partners"
          ADD CONSTRAINT "barrel_outbound_shipping_partners_barrel_id_fk"
          FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_partners_barrel_kind_idx"
      ON "barrel_outbound_shipping_partners" USING btree ("barrel_id", "charge_kind")
    `);

    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "phone" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "cashapp_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "zelle_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_phone" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_cashapp_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_zelle_id" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "cashapp_account" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "zelle_account" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "image_url" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "public_pricing_published_at" timestamp with time zone
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ADD COLUMN IF NOT EXISTS "customer_note" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_cashapp_account" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "partner_zelle_account" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "off_platform_payment_method" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "off_platform_payer_name" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "off_platform_receipt_url" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_charges"
      ADD COLUMN IF NOT EXISTS "off_platform_submitted_at" timestamp with time zone
    `);

    await db.execute(sql`
      ALTER TABLE "barrels"
      ADD COLUMN IF NOT EXISTS "outbound_charge_bundle" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrels"
      ADD COLUMN IF NOT EXISTS "outbound_company_rate_kinds" text
    `);
    await db.execute(sql`
      ALTER TABLE "barrel_outbound_shipping_partners"
      ALTER COLUMN "barrel_id" DROP NOT NULL
    `);

    await ensureOutboundShippingCompanyRatesTable();
    await ensureOutboundShippingCompanyRateLinksTable();
    await ensureOutboundShippingCatalogDefaultsTable();
    await ensureOutboundShippingRefundRequestsTable();

    schemaReady = true;
    return true;
  } catch (e) {
    console.error("[ensureBarrelOutboundShippingChargesSchema]", e);
    schemaReady = false;
    return false;
  }
}

let publicPricingColumnReady = false;

export async function ensureOutboundPartnerPublicPricingColumn(): Promise<void> {
  if (publicPricingColumnReady) return;
  const db = getDb();
  await db.execute(sql`
    ALTER TABLE "barrel_outbound_shipping_partners"
    ADD COLUMN IF NOT EXISTS "public_pricing_published_at" timestamp with time zone
  `);
  await db.execute(sql`
    ALTER TABLE "barrel_outbound_shipping_partners"
    ADD COLUMN IF NOT EXISTS "customer_note" text
  `);
  publicPricingColumnReady = true;
}

/** Idempotent even after the parent ensure already ran in this process. */
export async function ensureOutboundShippingCompanyRatesTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "outbound_shipping_company_rates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "company_name" text NOT NULL,
      "company_key" text NOT NULL,
      "table_kind" text NOT NULL,
      "row_label" text NOT NULL,
      "row_key" text NOT NULL,
      "cost_one_cents" integer NOT NULL,
      "cost_two_plus_cents" integer NOT NULL,
      "sort_index" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "outbound_shipping_company_rates_company_table_row_idx"
    ON "outbound_shipping_company_rates" ("company_key", "table_kind", "row_key")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "outbound_shipping_company_rates_company_idx"
    ON "outbound_shipping_company_rates" ("company_key")
  `);
  await db.execute(sql`
    ALTER TABLE "barrels"
    ADD COLUMN IF NOT EXISTS "outbound_company_rate_kinds" text
  `);
}

/** Idempotent even after the parent ensure already ran in this process. */
export async function ensureOutboundShippingCompanyRateLinksTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "outbound_shipping_company_rate_links" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "clerk_user_id" text NOT NULL,
      "company_key" text NOT NULL,
      "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL,
      "barrel_id" uuid NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "outbound_shipping_company_rate_links_unique"
    ON "outbound_shipping_company_rate_links" ("company_key", "charge_kind", "barrel_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "outbound_shipping_company_rate_links_user_idx"
    ON "outbound_shipping_company_rate_links" ("clerk_user_id")
  `);
}

export async function ensureOutboundShippingCatalogDefaultsTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "outbound_shipping_catalog_defaults" (
      "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
      "charge_bundle" text,
      "company_rate_kinds" text,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

export async function ensureOutboundShippingRefundRequestsTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "barrel_outbound_shipping_refund_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "charge_id" uuid NOT NULL,
      "barrel_id" uuid NOT NULL,
      "clerk_user_id" text NOT NULL,
      "charge_kind" "barrel_outbound_shipping_charge_kind" NOT NULL,
      "refund_path" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "amount_cents" integer NOT NULL,
      "stripe_refund_id" text,
      "support_ticket_id" uuid,
      "completed_at" timestamp with time zone,
      "completed_by_clerk_user_id" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_charge_uidx"
    ON "barrel_outbound_shipping_refund_requests" ("charge_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_barrel_idx"
    ON "barrel_outbound_shipping_refund_requests" ("barrel_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_clerk_idx"
    ON "barrel_outbound_shipping_refund_requests" ("clerk_user_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "barrel_outbound_shipping_refund_requests_status_idx"
    ON "barrel_outbound_shipping_refund_requests" ("status")
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "barrel_outbound_shipping_refund_requests"
        ADD CONSTRAINT "barrel_outbound_shipping_refund_requests_charge_id_fk"
        FOREIGN KEY ("charge_id") REFERENCES "public"."barrel_outbound_shipping_charges"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "barrel_outbound_shipping_refund_requests"
        ADD CONSTRAINT "barrel_outbound_shipping_refund_requests_barrel_id_fk"
        FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
}
