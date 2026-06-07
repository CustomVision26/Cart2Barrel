ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "out_of_stock_staff_note" text;
ALTER TABLE "item_requests" ADD COLUMN IF NOT EXISTS "out_of_stock_attachment_image_urls" text[];
