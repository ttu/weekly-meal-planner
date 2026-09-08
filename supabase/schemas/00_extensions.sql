-- gen_random_uuid() is core Postgres since 13, so pgcrypto is not needed. It
-- is also unavailable in pglite, which the integration tests run against.
create schema if not exists app;
