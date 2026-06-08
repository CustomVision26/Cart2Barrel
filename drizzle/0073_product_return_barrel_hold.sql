ALTER TABLE "order_item_product_return_requests" ADD COLUMN IF NOT EXISTS "held_barrel_id" uuid;
ALTER TABLE "order_item_product_return_requests" ADD COLUMN IF NOT EXISTS "held_package_id" uuid;
ALTER TABLE "order_item_product_return_requests" ADD COLUMN IF NOT EXISTS "held_fulfillment_status" "order_item_fulfillment_status";

DO $$ BEGIN
 ALTER TABLE "order_item_product_return_requests" ADD CONSTRAINT "order_item_product_return_requests_held_barrel_id_barrels_id_fk" FOREIGN KEY ("held_barrel_id") REFERENCES "public"."barrels"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "order_item_product_return_requests" ADD CONSTRAINT "order_item_product_return_requests_held_package_id_packages_id_fk" FOREIGN KEY ("held_package_id") REFERENCES "public"."packages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
