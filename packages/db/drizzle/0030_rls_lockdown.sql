-- SECURITY P0: PostgREST is internet-exposed and anon/authenticated held full
-- privileges on every public table (anon key could read users emails + 500
-- proxy_sessions credentials over the internet). Enable RLS (default-deny, no
-- policies) on all public tables and strip anon/authenticated privileges.
-- The app connects as `postgres` (rolbypassrls=true AND table owner) so this is
-- zero functional impact. We never use the Supabase REST API.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
