ALTER TYPE "public"."container_offering_kind" ADD VALUE IF NOT EXISTS 'cargo_box';
--> statement-breakpoint
ALTER TABLE "container_offerings" ADD COLUMN IF NOT EXISTS "customer_note" text;
--> statement-breakpoint
ALTER TABLE "container_offerings" ADD COLUMN IF NOT EXISTS "dimension_label" text;
