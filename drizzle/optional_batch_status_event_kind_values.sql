-- Optional Neon / psql snippet if batch lifecycle audits fail until schema is synced.
-- Prefer: `npm run db:push` from the repo root with DATABASE_URL set (aligns Drizzle schema).
--
-- Only run these if Postgres already has enum type batch_quote_session_status_event_kind.

ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'new_batch_request';
ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'quoted_batch';
ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'in_cart';
ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'paid_pending_staff_purchase';
ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'returned_to_quoted_batch';
ALTER TYPE batch_quote_session_status_event_kind ADD VALUE IF NOT EXISTS 'revision_reopened';
