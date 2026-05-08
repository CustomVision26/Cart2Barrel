/** Drop legacy exploratory tables from an earlier Cart2Barrel revision (no-op if absent). */
DROP TABLE IF EXISTS "order_items" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "barrels" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "shipments" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "orders" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."barrel_status" AS ENUM('filling', 'ready_to_ship', 'shipped', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."item_request_status" AS ENUM('pending', 'quoted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'purchasing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('packed', 'shipped', 'in_transit', 'delivered');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"label" text,
	"line1" text NOT NULL,
	"line2" text,
	"city_or_town" text,
	"parish" text,
	"country" text DEFAULT 'Jamaica' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barrel_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barrel_id" uuid NOT NULL,
	"package_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barrels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"status" "barrel_status" DEFAULT 'filling' NOT NULL,
	"capacity_percentage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_request_id" uuid NOT NULL,
	"item_cost" integer NOT NULL,
	"service_fee" integer NOT NULL,
	"estimated_shipping" integer NOT NULL,
	"total_price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"product_url" text NOT NULL,
	"product_name" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"note" text,
	"status" "item_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_request_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"total_amount" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"tracking_number" text,
	"received" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"order_id" uuid,
	"shipment_id" uuid,
	"amount" integer NOT NULL,
	"status" text NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_or_shipment_ck" CHECK ("payments"."order_id" IS NOT NULL OR "payments"."shipment_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barrel_id" uuid NOT NULL,
	"shipping_cost" integer NOT NULL,
	"tracking_number" text,
	"status" "shipment_status" DEFAULT 'packed' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barrel_items" ADD CONSTRAINT "barrel_items_barrel_id_barrels_id_fk" FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barrel_items" ADD CONSTRAINT "barrel_items_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barrels" ADD CONSTRAINT "barrels_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_quotes" ADD CONSTRAINT "item_quotes_item_request_id_item_requests_id_fk" FOREIGN KEY ("item_request_id") REFERENCES "public"."item_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_requests" ADD CONSTRAINT "item_requests_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_request_id_item_requests_id_fk" FOREIGN KEY ("item_request_id") REFERENCES "public"."item_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_barrel_id_barrels_id_fk" FOREIGN KEY ("barrel_id") REFERENCES "public"."barrels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_clerk_user_id_idx" ON "addresses" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "barrel_items_barrel_id_idx" ON "barrel_items" USING btree ("barrel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "barrel_items_package_id_unique" ON "barrel_items" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "barrels_clerk_user_id_idx" ON "barrels" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "item_quotes_item_request_id_idx" ON "item_quotes" USING btree ("item_request_id");--> statement-breakpoint
CREATE INDEX "item_requests_clerk_user_id_created_at_idx" ON "item_requests" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_item_request_id_idx" ON "order_items" USING btree ("item_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_order_id_item_request_id_unique" ON "order_items" USING btree ("order_id","item_request_id");--> statement-breakpoint
CREATE INDEX "orders_clerk_user_id_created_at_idx" ON "orders" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_payment_intent_id_unique" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "packages_order_item_id_idx" ON "packages" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "payments_clerk_user_id_created_at_idx" ON "payments" USING btree ("clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_order_id_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_shipment_id_idx" ON "payments" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipments_barrel_id_idx" ON "shipments" USING btree ("barrel_id");