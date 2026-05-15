ALTER TABLE "batch_quote_sessions" ADD COLUMN IF NOT EXISTS "cart_acceptance_accepted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "batch_quote_sessions" ADD COLUMN IF NOT EXISTS "cart_acceptance_accepted_estimate_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "batch_quote_sessions" ADD CONSTRAINT "batch_quote_sessions_cart_acceptance_estimate_fk" FOREIGN KEY ("cart_acceptance_accepted_estimate_id") REFERENCES "batch_quote_estimates"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
