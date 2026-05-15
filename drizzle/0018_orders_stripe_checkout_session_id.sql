ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text;
