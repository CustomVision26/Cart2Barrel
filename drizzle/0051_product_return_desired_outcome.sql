DO $$ BEGIN
  CREATE TYPE "order_item_product_return_desired_outcome" AS ENUM(
    'money_back',
    'replacement'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "order_item_product_return_requests"
  ADD COLUMN IF NOT EXISTS "desired_outcome" "order_item_product_return_desired_outcome";
