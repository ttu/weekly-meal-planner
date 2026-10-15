-- Local only: `supabase db reset` and a first `supabase start` run this, and
-- `supabase db push` does not, so no remote project ever gets it.

-- The beta key (supabase/schemas/12_beta_key.sql), so a development database
-- is gated exactly like staging and production. Not a secret: it opens nothing
-- but a database on a developer's own machine. The e2e suite types it in
-- (e2e/fixtures.ts).
select vault.create_secret('menami-beta', 'beta_key', 'Closed-beta key for starting and joining boards');
