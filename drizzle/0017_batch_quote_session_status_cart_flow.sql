ALTER TYPE "public"."batch_quote_session_status" ADD VALUE IF NOT EXISTS 'in_cart';
--> statement-breakpoint
ALTER TYPE "public"."batch_quote_session_status" ADD VALUE IF NOT EXISTS 'paid_pending_staff_purchase';
