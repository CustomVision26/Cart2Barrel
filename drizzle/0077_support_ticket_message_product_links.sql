ALTER TABLE "support_ticket_messages"
ADD COLUMN IF NOT EXISTS "product_links" jsonb;
