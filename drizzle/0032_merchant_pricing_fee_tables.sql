CREATE TABLE "merchant_packing_fee_settings" (
	"singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"packing_fee_per_line_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "merchant_packing_fee_settings" ("singleton_key", "packing_fee_per_line_cents") VALUES ('default', 0);
--> statement-breakpoint
CREATE TABLE "service_handling_fee_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"max_unit_price_inclusive_cents" integer NOT NULL,
	"fee_per_unit_cents" integer NOT NULL,
	"sort_index" integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_handling_fee_tiers_sort_idx" ON "service_handling_fee_tiers" USING btree ("sort_index");
--> statement-breakpoint
INSERT INTO "service_handling_fee_tiers" ("max_unit_price_inclusive_cents", "fee_per_unit_cents", "sort_index") VALUES
	(2000, 50, 1),
	(4000, 100, 2),
	(8000, 150, 3),
	(10000, 200, 4),
	(20000, 300, 5),
	(2147483647, 500, 6);
