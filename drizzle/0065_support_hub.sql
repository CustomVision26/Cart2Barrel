DO $$ BEGIN
  CREATE TYPE "public"."support_ticket_status" AS ENUM(
    'open',
    'awaiting_staff',
    'awaiting_customer',
    'resolved',
    'closed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."support_message_author_role" AS ENUM(
    'customer',
    'staff',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "hub_contact_settings" (
  "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "support_email" text,
  "support_phone" text,
  "whatsapp_number" text,
  "instagram_url" text,
  "facebook_url" text,
  "x_url" text,
  "tiktok_url" text,
  "business_hours" text,
  "public_intro" text,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_number" text NOT NULL,
  "clerk_user_id" text NOT NULL,
  "subject" text NOT NULL,
  "status" "support_ticket_status" DEFAULT 'open' NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_preview" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);

DO $$ BEGIN
  ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_clerk_user_id_profiles_clerk_user_id_fk"
  FOREIGN KEY ("clerk_user_id")
  REFERENCES "public"."profiles"("clerk_user_id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "support_tickets_user_last_message_idx"
ON "support_tickets" USING btree ("clerk_user_id", "last_message_at");

CREATE INDEX IF NOT EXISTS "support_tickets_status_last_message_idx"
ON "support_tickets" USING btree ("status", "last_message_at");

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL,
  "author_clerk_user_id" text,
  "author_role" "support_message_author_role" NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "support_messages"
  ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk"
  FOREIGN KEY ("ticket_id")
  REFERENCES "public"."support_tickets"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "support_messages_ticket_created_idx"
ON "support_messages" USING btree ("ticket_id", "created_at");

ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'support_ticket_submitted';
ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'support_ticket_customer_reply';
ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'support_ticket_staff_reply';
