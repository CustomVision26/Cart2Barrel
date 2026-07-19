ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "travel_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "airline_second_bag_usd_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "airline_third_bag_usd_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "special_feature_offers" ADD COLUMN IF NOT EXISTS "airline_fourth_bag_usd_cents" integer DEFAULT 0 NOT NULL;
