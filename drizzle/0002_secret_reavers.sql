/** Copy legacy profile street rows into `addresses` before dropping those columns. */
INSERT INTO "addresses" ("id", "clerk_user_id", "label", "line1", "line2", "city_or_town", "parish", "country", "is_default", "created_at")
SELECT
  gen_random_uuid(),
  p."clerk_user_id",
  'Default',
  trim(p."address_line1"),
  CASE
    WHEN p."address_line2" IS NOT NULL AND trim(p."address_line2") <> '' THEN trim(p."address_line2")
  END,
  CASE
    WHEN p."city_or_town" IS NOT NULL AND trim(p."city_or_town") <> '' THEN trim(p."city_or_town")
  END,
  p."parish",
  COALESCE(NULLIF(trim(p."country"), ''), 'Jamaica'),
  true,
  NOW()
FROM "profiles" p
WHERE
  p."address_line1" IS NOT NULL
  AND length(trim(p."address_line1")) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "addresses" a WHERE a."clerk_user_id" = p."clerk_user_id"
  );--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "address_line1";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "address_line2";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "city_or_town";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "parish";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "country";
