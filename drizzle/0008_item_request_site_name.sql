ALTER TABLE "item_requests" ADD COLUMN "site_name" text;--> statement-breakpoint
ALTER TABLE "item_request_line_snapshots" ADD COLUMN "site_name" text;
