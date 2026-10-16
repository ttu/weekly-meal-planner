-- Serialise the beta key's guess count and the record of a wrong guess, per
-- account and per address, so a burst of parallel guesses cannot all read the
-- same count and pass. The signature and return type are unchanged, so the
-- function is replaced in place. See supabase/schemas/42_sharing_rpc.sql.

-- Whether this account, or this address, has already guessed the beta key
-- wrong too often. Checked before the key is, and refusing the right key too:
-- a limit that a correct guess slips past does not bound guessing.
--
-- Takes a lock on the account and on the address first, held until the
-- transaction ends, so the count and the record of a wrong guess that follows
-- it are one step. Without it a burst of parallel guesses each reads the same
-- count and all pass. Always the account before the address, so two requests
-- cannot wait on each other. Volatile for the same reason: a stable function
-- counts against the caller's snapshot, taken before the lock was won.
create or replace function app.beta_key_guesses_exhausted(p_user_id uuid, p_ip text)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended('beta_key_user:' || p_user_id::text, 0));
  if p_ip is not null then
    perform pg_advisory_xact_lock(hashtextextended('beta_key_ip:' || p_ip, 0));
  end if;

  if (select count(*) from beta_key_attempt
      where user_id = p_user_id and attempted_at > now() - interval '1 hour') >= 10
  then
    return true;
  end if;

  return p_ip is not null
    and (select count(*) from beta_key_attempt
         where ip = p_ip and attempted_at > now() - interval '1 hour') >= 30;
end;
$fn$;
