-- QA 2026-10-20 defence in depth. Only SECURITY DEFINER functions (owner rights) and migrations write these tables.
-- BUG-006: no policies on purpose; run_once() is SECURITY DEFINER and keeps working.
alter table private.client_requests enable row level security;
-- BUG-009: the app only reads reference data.
revoke insert, update, delete on public.countries, public.operation_areas from anon, authenticated;
