// Idempotent apply for 0030: enable RLS on all public tables + revoke anon/authenticated.
// Safe: app connects as postgres (BYPASSRLS + table owner). We never use PostgREST.
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: new URL("../../../.env.local", import.meta.url).pathname });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

// Preflight guard: refuse to run if the connecting role can't bypass RLS, else
// enabling RLS with no policies would lock the app out of its own data.
const [role] = await sql`select rolname, rolbypassrls from pg_roles where rolname = current_user`;
const [{ ok }] = await sql`select (${role.rolbypassrls} or exists(
  select 1 from pg_tables where schemaname='public' and tableowner = current_user limit 1)) as ok`;
if (!ok) {
  console.error("ABORT: connecting role neither BYPASSRLS nor table owner — enabling RLS would lock out the app.");
  process.exit(1);
}
console.log(`connecting as ${role.rolname} (bypassrls=${role.rolbypassrls}) — safe to proceed`);

await sql`DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$`;

await sql`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`;
await sql`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`;
await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`;
await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated`;

const [counts] = await sql`select
  (select count(*)::int from pg_tables where schemaname='public') as total,
  (select count(*)::int from pg_tables t join pg_class c on c.relname=t.tablename
     and c.relnamespace='public'::regnamespace where t.schemaname='public' and c.relrowsecurity) as rls_on`;
const grants = await sql`select grantee, count(*)::int n from information_schema.role_table_grants
  where table_schema='public' and grantee in ('anon','authenticated') group by grantee`;
console.log(`RLS enabled on ${counts.rls_on}/${counts.total} public tables`);
console.log(`remaining anon/authenticated table grants (want none):`, JSON.stringify(grants));
// App still works as postgres:
const [{ n }] = await sql`select count(*)::int n from users`;
console.log(`app-role read after lockdown: users count = ${n} (app unaffected)`);
await sql.end();
