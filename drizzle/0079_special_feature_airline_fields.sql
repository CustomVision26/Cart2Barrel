ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "airline_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "airline_fifty_pound_charge_usd_cents" integer DEFAULT 0 NOT NULL;
