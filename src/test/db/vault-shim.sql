create schema if not exists vault;

-- pglite has no supabase_vault extension. Production keeps secrets encrypted in
-- vault.secrets and reads them back through vault.decrypted_secrets; here the
-- secret is stored as it is, behind the same names, so the functions that read
-- it run unchanged.
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null
);

create view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret from vault.secrets;

create function vault.create_secret(
  new_secret text,
  new_name text default null,
  new_description text default null
)
returns uuid
language sql
as $fn$
  insert into vault.secrets (name, secret) values (new_name, new_secret) returning id;
$fn$;
