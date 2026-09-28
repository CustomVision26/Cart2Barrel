ALTER TABLE "barrel_outbound_shipping_partners"
ADD COLUMN IF NOT EXISTS "public_pricing_published_at" timestamp with time zone;
