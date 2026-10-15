-- The beta key.
--
-- Anonymous boards (ADR 0010) let anyone with the app start one. Until email
-- verification exists, a shared key closes starting and joining a board to
-- people who have been given it. The key lives in Supabase Vault as the secret
-- named 'beta_key', set per project in the dashboard; with no such secret there
-- is no gate. Removing the secret is how the gate comes off.
--
-- Checked here and nowhere else: a key checked by the app is a key anyone can
-- skip by calling the RPC directly.

-- Whether a key was given that lets the caller through. Security invoker, and
-- not in an exposed schema: only the SECURITY DEFINER board functions call it,
-- and run as anyone else it cannot read the Vault at all.
create or replace function app.beta_key_accepted(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select not exists (select 1 from vault.decrypted_secrets where name = 'beta_key')
      or exists (
        select 1 from vault.decrypted_secrets
        where name = 'beta_key' and decrypted_secret = p_key
      );
$fn$;

revoke execute on function app.beta_key_accepted(text) from public;

-- Whether the start and join screens should ask for the key at all. Says
-- whether a key exists and nothing about it.
create or replace function public.beta_key_required()
returns boolean
language sql
stable
security definer
set search_path = '', pg_temp
as $fn$
  select exists (select 1 from vault.decrypted_secrets where name = 'beta_key');
$fn$;

grant execute on function public.beta_key_required() to anon, authenticated;
