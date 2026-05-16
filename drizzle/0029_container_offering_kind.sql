CREATE TYPE "public"."container_offering_kind" AS ENUM('barrel', 'bin');
--> statement-breakpoint
ALTER TABLE "container_offerings" ADD COLUMN "kind" "public"."container_offering_kind" DEFAULT 'barrel' NOT NULL;
