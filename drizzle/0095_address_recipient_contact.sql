ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "recipient_name" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "recipient_phone" text;--> statement-breakpoint
UPDATE "addresses" AS a
SET
  "recipient_name" = COALESCE(a."recipient_name", p."full_name"),
  "recipient_phone" = COALESCE(a."recipient_phone", p."phone")
FROM "profiles" AS p
WHERE p."clerk_user_id" = a."clerk_user_id";
