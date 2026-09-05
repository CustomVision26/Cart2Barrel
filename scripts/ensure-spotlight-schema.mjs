/**
 * Idempotent fix for spotlight_category_products (table + price_usd_cents column).
 * Run: npm run db:ensure-spotlight
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS "spotlight_category_products" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "category_slug" text NOT NULL,
    "product_url" text NOT NULL,
    "image_url" text,
    "price_usd_cents" integer,
    "label" text,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "price_usd_cents" integer
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "product_size" text
`;

await sql`
  ALTER TABLE "spotlight_category_products"
  ADD COLUMN IF NOT EXISTS "product_color" text
`;

await sql`
  CREATE INDEX IF NOT EXISTS "spotlight_category_products_slug_active_sort_idx"
  ON "spotlight_category_products" USING btree ("category_slug", "is_active", "sort_index")
`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'spotlight_category_products'
  ORDER BY ordinal_position
`;
console.log(
  "spotlight_category_products ready:",
  cols.map((c) => c.column_name).join(", "),
);

await sql`
  CREATE TABLE IF NOT EXISTS "spotlight_product_variants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_product_id" uuid NOT NULL,
    "product_url" text,
    "image_url" text,
    "price_usd_cents" integer,
    "product_size" text,
    "product_color" text,
    "pack_label" text,
    "label" text,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "spotlight_product_variants"
    ADD CONSTRAINT "spotlight_product_variants_parent_product_id_fk"
    FOREIGN KEY ("parent_product_id")
    REFERENCES "spotlight_category_products"("id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "spotlight_product_variants_parent_active_sort_idx"
  ON "spotlight_product_variants" USING btree ("parent_product_id", "is_active", "sort_index")
`;

const variantCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'spotlight_product_variants'
  ORDER BY ordinal_position
`;
console.log(
  "spotlight_product_variants ready:",
  variantCols.map((c) => c.column_name).join(", "),
);

await sql`
  CREATE TABLE IF NOT EXISTS "spotlight_categories" (
    "slug" text PRIMARY KEY NOT NULL,
    "title" text DEFAULT '' NOT NULL,
    "description" text DEFAULT '' NOT NULL,
    "tag" text DEFAULT 'New' NOT NULL,
    "price_hint" text DEFAULT '' NOT NULL,
    "gradient" text DEFAULT 'from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15' NOT NULL,
    "icon_name" text DEFAULT 'package' NOT NULL,
    "sort_index" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "title" text DEFAULT '' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "tag" text DEFAULT 'New' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "price_hint" text DEFAULT '' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "gradient" text DEFAULT 'from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "icon_name" text DEFAULT 'package' NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "sort_index" integer DEFAULT 0 NOT NULL`;
await sql`ALTER TABLE "spotlight_categories" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL`;

const defaultCategories = [
  {
    slug: "electronics-tech",
    title: "Electronics & tech",
    description:
      "Laptops, audio, and smart home—request a quote, we handle the buy.",
    tag: "Popular",
    priceHint: "Estimates from $89",
    gradient:
      "from-sky-500/25 via-violet-500/15 to-background dark:from-sky-400/20 dark:via-violet-500/10",
    iconName: "headphones",
    sortIndex: 0,
  },
  {
    slug: "fashion-footwear",
    title: "Fashion & footwear",
    description:
      "Seasonal drops and everyday staples consolidated for barrel shipping.",
    tag: "New season",
    priceHint: "Bundle & save",
    gradient:
      "from-rose-500/25 via-amber-500/10 to-background dark:from-rose-400/15 dark:via-amber-500/10",
    iconName: "shirt",
    sortIndex: 1,
  },
  {
    slug: "home-kitchen",
    title: "Home & kitchen",
    description:
      "Small appliances, cookware, and décor shipped to our hub for packing.",
    tag: "Editor's pick",
    priceHint: "Deals weekly",
    gradient: "from-emerald-500/20 via-teal-500/10 to-background dark:from-emerald-400/15",
    iconName: "home",
    sortIndex: 2,
  },
  {
    slug: "beauty-wellness",
    title: "Beauty & wellness",
    description:
      "Top brands with vetted listings—checkout when your cart is ready.",
    tag: "Self-care",
    priceHint: "From $12 items",
    gradient:
      "from-fuchsia-500/20 via-pink-500/10 to-background dark:from-fuchsia-400/15",
    iconName: "heart",
    sortIndex: 3,
  },
  {
    slug: "barrel-ready-bundles",
    title: "Barrel-ready bundles",
    description:
      "Mix categories in one shipment; we consolidate and label for Jamaica.",
    tag: "Best value",
    priceHint: "One hub, one address",
    gradient:
      "from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15",
    iconName: "package",
    sortIndex: 4,
  },
];

for (const category of defaultCategories) {
  await sql`
    INSERT INTO "spotlight_categories" (
      "slug", "title", "description", "tag", "price_hint", "gradient",
      "icon_name", "sort_index", "is_active"
    )
    VALUES (
      ${category.slug}, ${category.title}, ${category.description}, ${category.tag},
      ${category.priceHint}, ${category.gradient}, ${category.iconName},
      ${category.sortIndex}, true
    )
    ON CONFLICT ("slug") DO NOTHING
  `;
  await sql`
    UPDATE "spotlight_categories"
    SET
      "title" = ${category.title},
      "description" = ${category.description},
      "tag" = ${category.tag},
      "price_hint" = ${category.priceHint},
      "gradient" = ${category.gradient},
      "icon_name" = ${category.iconName},
      "sort_index" = ${category.sortIndex}
    WHERE "slug" = ${category.slug}
      AND trim(coalesce("title", '')) = ''
  `;
}

const categoryCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'spotlight_categories'
  ORDER BY ordinal_position
`;
console.log(
  "spotlight_categories ready:",
  categoryCols.map((c) => c.column_name).join(", "),
);
