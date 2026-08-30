CREATE TABLE IF NOT EXISTS "hub_ship_from_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text DEFAULT 'United States' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"updated_by_clerk_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_ship_from_addresses_is_primary_idx" ON "hub_ship_from_addresses" ("is_primary");
