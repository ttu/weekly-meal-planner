-- Board passwords are hashed with bcrypt in the database, so the plaintext
-- never lands in a table and the client never sees a hash. pglite ships this
-- as a contrib extension, so the join tests run against the real thing.
create extension if not exists pgcrypto with schema extensions;
