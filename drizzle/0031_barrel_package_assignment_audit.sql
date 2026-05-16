CREATE TYPE "public"."barrel_package_assignment_action" AS ENUM('assigned', 'reassigned', 'removed');
--> statement-breakpoint
ALTER TABLE "barrels" ADD COLUMN "order_container_item_id" uuid;
--> statement-breakpoint
ALTER TABLE "barrels" ADD COLUMN "unit_ordinal" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "barrels" ADD CONSTRAINT "barrels_order_container_item_id_order_container_items_id_fk" FOREIGN KEY ("order_container_item_id") REFERENCES "public"."order_container_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "barrels_order_container_item_id_idx" ON "barrels" USING btree ("order_container_item_id");
--> statement-breakpoint
CREATE TABLE "barrel_package_assignment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_clerk_user_id" text NOT NULL,
	"package_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"from_barrel_id" uuid,
	"to_barrel_id" uuid,
	"action" "barrel_package_assignment_action" NOT NULL,
	"actor_clerk_user_id" text NOT NULL,
	"admin_note" text,
	"product_name_snapshot" text,
	"barrel_label_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "barrel_package_assignment_events" ADD CONSTRAINT "barrel_package_assignment_events_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "barrel_package_assignment_events" ADD CONSTRAINT "barrel_package_assignment_events_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "barrel_package_assignment_events" ADD CONSTRAINT "barrel_package_assignment_events_from_barrel_id_barrels_id_fk" FOREIGN KEY ("from_barrel_id") REFERENCES "public"."barrels"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "barrel_package_assignment_events" ADD CONSTRAINT "barrel_package_assignment_events_to_barrel_id_barrels_id_fk" FOREIGN KEY ("to_barrel_id") REFERENCES "public"."barrels"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "barrel_pkg_assign_events_owner_created_idx" ON "barrel_package_assignment_events" USING btree ("owner_clerk_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "barrel_pkg_assign_events_package_idx" ON "barrel_package_assignment_events" USING btree ("package_id");
