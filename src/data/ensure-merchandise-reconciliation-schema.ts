import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let schemaReady = false;
let schemaReadyInFlight: Promise<boolean> | null = null;

/**
 * Creates merchandise reconciliation table / enum when missing.
 * Idempotent until `npm run db:push` / migrate / ensure script has run.
 *
 * Fast-path: if the table already exists, skip DDL (ALTER TYPE ADD VALUE can
 * block for a long time under concurrent traffic and stall RSC renders).
 */
export async function ensureMerchandiseReconciliationSchema(): Promise<boolean> {
  if (schemaReady) {
    return true;
  }
  if (schemaReadyInFlight) {
    return schemaReadyInFlight;
  }

  schemaReadyInFlight = ensureMerchandiseReconciliationSchemaInner().finally(
    () => {
      schemaReadyInFlight = null;
    },
  );
  return schemaReadyInFlight;
}

async function ensureMerchandiseTopupChargeBreakdownsTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."merchandise_topup_charge_breakdown_status" AS ENUM(
        'pending',
        'paid',
        'revoked'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchandise_topup_charge_breakdowns" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "clerk_user_id" text NOT NULL,
      "group_key" text NOT NULL,
      "reconciliation_id" uuid NOT NULL,
      "checkout_merchandise_cents" integer NOT NULL,
      "checkout_shipping_cents" integer DEFAULT 0 NOT NULL,
      "checkout_tax_cents" integer DEFAULT 0 NOT NULL,
      "checkout_service_cents" integer DEFAULT 0 NOT NULL,
      "actual_merchandise_cents" integer NOT NULL,
      "actual_shipping_cents" integer DEFAULT 0 NOT NULL,
      "actual_tax_cents" integer DEFAULT 0 NOT NULL,
      "actual_service_cents" integer DEFAULT 0 NOT NULL,
      "delta_cents" integer NOT NULL,
      "amount_cents" integer NOT NULL,
      "prior_paid_net_cents" integer DEFAULT 0 NOT NULL,
      "status" "merchandise_topup_charge_breakdown_status" DEFAULT 'pending' NOT NULL,
      "topup_payment_id" uuid,
      "topup_expires_at" timestamp with time zone,
      "created_by_clerk_user_id" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_clerk_user_id_idx"
    ON "merchandise_topup_charge_breakdowns" USING btree ("clerk_user_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_group_key_idx"
    ON "merchandise_topup_charge_breakdowns" USING btree ("group_key")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_recon_id_idx"
    ON "merchandise_topup_charge_breakdowns" USING btree ("reconciliation_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merch_topup_breakdown_status_idx"
    ON "merchandise_topup_charge_breakdowns" USING btree ("status")
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_charge_breakdowns"
        ADD CONSTRAINT "merchandise_topup_charge_breakdowns_clerk_user_id_fk"
        FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_charge_breakdowns"
        ADD CONSTRAINT "merchandise_topup_charge_breakdowns_recon_fk"
        FOREIGN KEY ("reconciliation_id")
        REFERENCES "public"."order_item_merchandise_reconciliations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_charge_breakdowns"
        ADD CONSTRAINT "merchandise_topup_charge_breakdowns_payment_fk"
        FOREIGN KEY ("topup_payment_id")
        REFERENCES "public"."merchandise_topup_payments"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
}

async function ensureMerchandiseTopupPaymentsTables(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchandise_topup_payments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "clerk_user_id" text NOT NULL,
      "checkout_order_id" uuid NOT NULL,
      "amount_cents" integer NOT NULL,
      "refunded_cents" integer DEFAULT 0 NOT NULL,
      "paid_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "merchandise_topup_payments_checkout_order_id_uidx"
    ON "merchandise_topup_payments" USING btree ("checkout_order_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merchandise_topup_payments_clerk_user_id_idx"
    ON "merchandise_topup_payments" USING btree ("clerk_user_id")
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_payments"
        ADD CONSTRAINT "merchandise_topup_payments_clerk_user_id_fk"
        FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_payments"
        ADD CONSTRAINT "merchandise_topup_payments_checkout_order_id_fk"
        FOREIGN KEY ("checkout_order_id") REFERENCES "public"."orders"("id")
        ON DELETE restrict ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "merchandise_topup_payment_reconciliations" (
      "payment_id" uuid NOT NULL,
      "reconciliation_id" uuid NOT NULL,
      PRIMARY KEY ("payment_id", "reconciliation_id")
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "merchandise_topup_payment_recons_recon_idx"
    ON "merchandise_topup_payment_reconciliations" USING btree ("reconciliation_id")
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_payment_reconciliations"
        ADD CONSTRAINT "merchandise_topup_payment_recons_payment_fk"
        FOREIGN KEY ("payment_id") REFERENCES "public"."merchandise_topup_payments"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "merchandise_topup_payment_reconciliations"
        ADD CONSTRAINT "merchandise_topup_payment_recons_recon_fk"
        FOREIGN KEY ("reconciliation_id")
        REFERENCES "public"."order_item_merchandise_reconciliations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);

  // Backfill one payment row from the latest stored checkout order on each recon.
  await db.execute(sql`
    INSERT INTO "merchandise_topup_payments" (
      "id", "clerk_user_id", "checkout_order_id", "amount_cents",
      "refunded_cents", "paid_at", "created_at"
    )
    SELECT DISTINCT ON (r."topup_checkout_order_id")
      gen_random_uuid(),
      r."clerk_user_id",
      r."topup_checkout_order_id",
      LEAST(
        GREATEST(COALESCE(r."topup_amount_cents", 0), 0),
        GREATEST(o."total_amount", 0)
      ),
      LEAST(
        COALESCE(r."topup_refunded_cents", 0),
        LEAST(
          GREATEST(COALESCE(r."topup_amount_cents", 0), 0),
          GREATEST(o."total_amount", 0)
        )
      ),
      COALESCE(r."topup_paid_at", r."updated_at", now()),
      now()
    FROM "order_item_merchandise_reconciliations" r
    INNER JOIN "orders" o ON o."id" = r."topup_checkout_order_id"
    WHERE r."topup_checkout_order_id" IS NOT NULL
      AND COALESCE(r."topup_paid_total_cents", 0) > 0
      AND LEAST(
        GREATEST(COALESCE(r."topup_amount_cents", 0), 0),
        GREATEST(o."total_amount", 0)
      ) > 0
      AND NOT EXISTS (
        SELECT 1 FROM "merchandise_topup_payments" p
        WHERE p."checkout_order_id" = r."topup_checkout_order_id"
      )
    ORDER BY r."topup_checkout_order_id", r."updated_at" DESC
  `);

  await db.execute(sql`
    INSERT INTO "merchandise_topup_payment_reconciliations" (
      "payment_id", "reconciliation_id"
    )
    SELECT p."id", r."id"
    FROM "order_item_merchandise_reconciliations" r
    INNER JOIN "merchandise_topup_payments" p
      ON p."checkout_order_id" = r."topup_checkout_order_id"
    WHERE r."topup_checkout_order_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "merchandise_topup_payment_reconciliations" link
        WHERE link."payment_id" = p."id"
          AND link."reconciliation_id" = r."id"
      )
  `);
}

async function ensureMerchandiseTopupCartTable(): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user_merchandise_topup_cart_lines" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "clerk_user_id" text NOT NULL,
      "reconciliation_id" uuid NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_merch_topup_cart_user_recon_unique"
    ON "user_merchandise_topup_cart_lines" USING btree ("clerk_user_id", "reconciliation_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "user_merch_topup_cart_clerk_user_id_idx"
    ON "user_merchandise_topup_cart_lines" USING btree ("clerk_user_id")
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "user_merchandise_topup_cart_lines"
        ADD CONSTRAINT "user_merchandise_topup_cart_lines_clerk_user_id_profiles_clerk_user_id_fk"
        FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "user_merchandise_topup_cart_lines"
        ADD CONSTRAINT "user_merchandise_topup_cart_lines_reconciliation_id_fk"
        FOREIGN KEY ("reconciliation_id")
        REFERENCES "public"."order_item_merchandise_reconciliations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
}

async function ensureMerchandiseReconciliationSchemaInner(): Promise<boolean> {
  const db = getDb();
  try {
    // Fast path — table already present (normal after migrate / first ensure).
    try {
      await db.execute(
        sql`SELECT 1 FROM "order_item_merchandise_reconciliations" LIMIT 1`,
      );
      try {
        await ensureMerchandiseTopupCartTable();
        await ensureMerchandiseTopupPaymentsTables();
        await ensureMerchandiseTopupChargeBreakdownsTable();
      } catch (e) {
        console.warn(
          "[Cart2Barrel] ensureMerchandiseTopupCartTable skipped:",
          e,
        );
      }
      schemaReady = true;
      return true;
    } catch {
      // Table missing — continue with create path.
    }

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "public"."order_item_merchandise_reconciliation_status" AS ENUM(
          'recorded',
          'customer_notified',
          'topup_pending',
          'topup_paid',
          'matched',
          'cancelled'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    // Enum value adds can lock under load — best-effort only.
    try {
      await db.execute(sql`
        ALTER TYPE "public"."user_status_update_kind"
        ADD VALUE IF NOT EXISTS 'merchandise_price_change'
      `);
      await db.execute(sql`
        ALTER TYPE "public"."user_status_update_kind"
        ADD VALUE IF NOT EXISTS 'merchandise_topup_required'
      `);
    } catch (e) {
      console.warn(
        "[Cart2Barrel] ensureMerchandiseReconciliationSchema enum add skipped:",
        e,
      );
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "order_item_merchandise_reconciliations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_item_id" uuid NOT NULL,
        "clerk_user_id" text NOT NULL,
        "checkout_merchandise_cents" integer NOT NULL,
        "checkout_shipping_cents" integer DEFAULT 0 NOT NULL,
        "checkout_tax_cents" integer DEFAULT 0 NOT NULL,
        "checkout_service_cents" integer DEFAULT 0 NOT NULL,
        "actual_merchandise_cents" integer NOT NULL,
        "actual_shipping_cents" integer DEFAULT 0 NOT NULL,
        "actual_tax_cents" integer DEFAULT 0 NOT NULL,
        "actual_service_cents" integer DEFAULT 0 NOT NULL,
        "delta_cents" integer NOT NULL,
        "status" "order_item_merchandise_reconciliation_status" NOT NULL,
        "support_ticket_id" uuid,
        "customer_message" text,
        "topup_amount_cents" integer,
        "topup_expires_at" timestamp with time zone,
        "topup_paid_at" timestamp with time zone,
        "resolved_at" timestamp with time zone,
        "created_by_clerk_user_id" text NOT NULL,
        "updated_by_clerk_user_id" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "checkout_shipping_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "checkout_tax_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "actual_shipping_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "actual_tax_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "checkout_service_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "actual_service_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "topup_checkout_order_id" uuid
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "topup_refunded_cents" integer DEFAULT 0 NOT NULL
    `);
    await db.execute(sql`
      ALTER TABLE "order_item_merchandise_reconciliations"
      ADD COLUMN IF NOT EXISTS "topup_paid_total_cents" integer DEFAULT 0 NOT NULL
    `);
    // Backfill: rows already marked paid should count their top-up as collected.
    await db.execute(sql`
      UPDATE "order_item_merchandise_reconciliations"
      SET "topup_paid_total_cents" = GREATEST(
        COALESCE("topup_amount_cents", 0),
        COALESCE("topup_paid_total_cents", 0)
      )
      WHERE "topup_paid_at" IS NOT NULL
        AND COALESCE("topup_paid_total_cents", 0) = 0
        AND COALESCE("topup_amount_cents", 0) > 0
    `);
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "order_item_merchandise_reconciliations"
          ADD CONSTRAINT "order_item_merch_recon_topup_checkout_order_id_fk"
          FOREIGN KEY ("topup_checkout_order_id") REFERENCES "public"."orders"("id")
          ON DELETE set null ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "order_item_merch_recon_topup_checkout_order_id_idx"
      ON "order_item_merchandise_reconciliations" USING btree ("topup_checkout_order_id")
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "order_item_merchandise_reconciliations"
          ADD CONSTRAINT "order_item_merchandise_reconciliations_order_item_id_order_items_id_fk"
          FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "order_item_merchandise_reconciliations"
          ADD CONSTRAINT "order_item_merchandise_reconciliations_clerk_user_id_profiles_clerk_user_id_fk"
          FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "order_item_merchandise_reconciliations_order_item_id_unique"
      ON "order_item_merchandise_reconciliations" USING btree ("order_item_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "order_item_merch_recon_clerk_user_id_idx"
      ON "order_item_merchandise_reconciliations" USING btree ("clerk_user_id")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "order_item_merch_recon_status_idx"
      ON "order_item_merchandise_reconciliations" USING btree ("status")
    `);

    await ensureMerchandiseTopupCartTable();
    await ensureMerchandiseTopupPaymentsTables();
    await ensureMerchandiseTopupChargeBreakdownsTable();

    schemaReady = true;
    return true;
  } catch (e) {
    console.error("[Cart2Barrel] ensureMerchandiseReconciliationSchema failed:", e);
    return false;
  }
}
