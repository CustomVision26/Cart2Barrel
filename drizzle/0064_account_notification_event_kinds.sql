ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'user_registered';
ALTER TYPE "public"."admin_user_activity_event_kind" ADD VALUE IF NOT EXISTS 'user_banned';
ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_welcome';
ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_suspended';
ALTER TYPE "public"."user_status_update_kind" ADD VALUE IF NOT EXISTS 'account_reinstated';
