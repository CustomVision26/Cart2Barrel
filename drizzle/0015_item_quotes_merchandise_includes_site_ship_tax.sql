ALTER TABLE "item_quotes" ADD COLUMN IF NOT EXISTS "merchandise_includes_site_shipping_tax" boolean NOT NULL DEFAULT false;
