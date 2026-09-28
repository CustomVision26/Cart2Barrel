CREATE TABLE IF NOT EXISTS "outbound_shipping_catalog_defaults" (
  "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "charge_bundle" text,
  "company_rate_kinds" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
