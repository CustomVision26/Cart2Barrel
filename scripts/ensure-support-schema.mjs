/**
 * Idempotent support schema (aligns with existing Neon tables when present).
 * Run: npm run db:ensure-support
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`
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
  END $$
`;

await sql`ALTER TYPE "public"."support_ticket_status" ADD VALUE IF NOT EXISTS 'awaiting_staff'`;
await sql`ALTER TYPE "public"."support_ticket_status" ADD VALUE IF NOT EXISTS 'awaiting_customer'`;
await sql`ALTER TYPE "public"."support_ticket_status" ADD VALUE IF NOT EXISTS 'resolved'`;
await sql`ALTER TYPE "public"."support_ticket_status" ADD VALUE IF NOT EXISTS 'closed'`;

await sql`ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'support_reply'`;
await sql`ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'support_ticket_submitted'`;
await sql`ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'support_ticket_replied'`;

await sql`
  CREATE TABLE IF NOT EXISTS "hub_contact_settings" (
    "singleton_key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
    "support_email" text,
    "support_phone" text,
    "whatsapp_number" text,
    "instagram_url" text,
    "facebook_url" text,
    "x_url" text,
    "tiktok_url" text,
    "public_intro" text,
    "business_hours" text,
    "updated_by_clerk_user_id" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

const hubColumns = [
  ["support_phone", "text"],
  ["whatsapp_number", "text"],
  ["instagram_url", "text"],
  ["facebook_url", "text"],
  ["x_url", "text"],
  ["tiktok_url", "text"],
  ["public_intro", "text"],
  ["business_hours", "text"],
  ["updated_by_clerk_user_id", "text"],
];

for (const [name, type] of hubColumns) {
  await sql.unsafe(
    `ALTER TABLE "hub_contact_settings" ADD COLUMN IF NOT EXISTS "${name}" ${type}`,
  );
}

await sql`
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
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

for (const [name, type] of [
  ["ticket_number", "text"],
  ["last_message_preview", "text"],
  ["resolved_at", "timestamp with time zone"],
]) {
  await sql.unsafe(
    `ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "${name}" ${type}`,
  );
}

await sql`
  DO $$ BEGIN
    ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_clerk_user_id_profiles_clerk_user_id_fk"
    FOREIGN KEY ("clerk_user_id")
    REFERENCES "public"."profiles"("clerk_user_id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "support_tickets_user_last_msg_idx"
  ON "support_tickets" USING btree ("clerk_user_id", "last_message_at")
`;

await sql`
  CREATE INDEX IF NOT EXISTS "support_tickets_status_last_msg_idx"
  ON "support_tickets" USING btree ("status", "last_message_at")
`;

await sql`
  CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "ticket_id" uuid NOT NULL,
    "sender_clerk_user_id" text NOT NULL,
    "is_from_staff" boolean DEFAULT false NOT NULL,
    "body" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`;

await sql`
  DO $$ BEGIN
    ALTER TABLE "support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_support_tickets_id_fk"
    FOREIGN KEY ("ticket_id")
    REFERENCES "public"."support_tickets"("id")
    ON DELETE cascade ON UPDATE no action;
  EXCEPTION
    WHEN duplicate_object THEN null;
  END $$
`;

await sql`
  CREATE INDEX IF NOT EXISTS "support_ticket_messages_ticket_created_idx"
  ON "support_ticket_messages" USING btree ("ticket_id", "created_at")
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'hub_contact_settings',
      'support_tickets',
      'support_ticket_messages'
    )
  ORDER BY table_name
`;
console.log(
  "support schema ready:",
  tables.map((t) => t.table_name).join(", "),
);
