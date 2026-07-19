ALTER TYPE "public"."container_offering_kind" ADD VALUE IF NOT EXISTS 'suitcase';
--> statement-breakpoint
CREATE TYPE "public"."special_feature_packaging_mode" AS ENUM('in_app', 'outside');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "special_feature_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"size_label" text NOT NULL,
	"destination_location" text NOT NULL,
	"packaging_mode" "public"."special_feature_packaging_mode" DEFAULT 'in_app' NOT NULL,
	"price_usd_cents" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"container_offering_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "special_feature_offers" ADD CONSTRAINT "special_feature_offers_container_offering_id_container_offerings_id_fk" FOREIGN KEY ("container_offering_id") REFERENCES "public"."container_offerings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_feature_offers_active_window_idx" ON "special_feature_offers" USING btree ("is_active","starts_at","ends_at");
