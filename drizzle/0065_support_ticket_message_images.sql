ALTER TABLE "support_ticket_messages"
ADD COLUMN IF NOT EXISTS "image_urls" jsonb;
