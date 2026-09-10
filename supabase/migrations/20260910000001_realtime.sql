-- Realtime publishes row changes on these tables so two Members planning on the
-- same sofa see each other's edits within a second. RLS still applies to the
-- stream: a Member never receives another Household's rows.
alter publication supabase_realtime add table cook_event;
alter publication supabase_realtime add table leftover;
alter publication supabase_realtime add table backlog_item;
