create schema if not exists auth;

-- pglite has no Supabase auth layer. Production resolves auth.uid() from the
-- verified JWT; here it reads a session-local setting that tests control.
-- This is the one knowing divergence from production (ADR 0007).
create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$fn$;
