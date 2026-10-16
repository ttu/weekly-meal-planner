-- The beta key now matches whatever its case and surrounding whitespace, on
-- both the key given and the key set. See supabase/schemas/12_beta_key.sql.

create or replace function app.beta_key_accepted(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $fn$
  select not exists (select 1 from vault.decrypted_secrets where name = 'beta_key')
      or exists (
        select 1 from vault.decrypted_secrets
        where name = 'beta_key'
          and lower(btrim(decrypted_secret, E' \t\r\n'))
            = lower(btrim(p_key, E' \t\r\n'))
      );
$fn$;

revoke execute on function app.beta_key_accepted(text) from public;
