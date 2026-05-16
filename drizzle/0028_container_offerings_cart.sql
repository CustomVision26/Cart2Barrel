CREATE TABLE "container_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"size_label" text NOT NULL,
	"price_usd_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "container_offerings_active_sort_idx" ON "container_offerings" USING btree ("is_active","sort_index");
--> statement-breakpoint
CREATE TABLE "container_offering_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"container_offering_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "container_offering_images_container_offering_id_container_offerings_id_fk" FOREIGN KEY ("container_offering_id") REFERENCES "public"."container_offerings"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX "container_offering_images_offering_id_idx" ON "container_offering_images" USING btree ("container_offering_id");
--> statement-breakpoint
CREATE TABLE "user_container_cart_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"container_offering_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_container_cart_lines_clerk_user_id_profiles_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."profiles"("clerk_user_id") ON DELETE CASCADE,
	CONSTRAINT "user_container_cart_lines_container_offering_id_container_offerings_id_fk" FOREIGN KEY ("container_offering_id") REFERENCES "public"."container_offerings"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_container_cart_lines_user_offering_unique" ON "user_container_cart_lines" USING btree ("clerk_user_id","container_offering_id");
--> statement-breakpoint
CREATE INDEX "user_container_cart_lines_clerk_user_id_idx" ON "user_container_cart_lines" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE TABLE "order_container_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"container_offering_id" uuid,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"name_snapshot" text NOT NULL,
	"size_snapshot" text NOT NULL,
	CONSTRAINT "order_container_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
	CONSTRAINT "order_container_items_container_offering_id_container_offerings_id_fk" FOREIGN KEY ("container_offering_id") REFERENCES "public"."container_offerings"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "order_container_items_order_id_idx" ON "order_container_items" USING btree ("order_id");
