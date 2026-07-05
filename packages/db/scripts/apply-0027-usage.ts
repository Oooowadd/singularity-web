// Idempotent apply for 0027: usage_events + pipeline_runs.user_id + backfill.
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: new URL("../../../.env.local", import.meta.url).pathname });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

await sql`ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL`;

await sql`CREATE TABLE IF NOT EXISTS usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  run_id uuid,
  feature text,
  resource_type text NOT NULL,
  provider text NOT NULL,
  model text,
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  audio_seconds real,
  api_calls integer,
  estimated_cost_usd numeric(12,6),
  price_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
)`;
await sql`CREATE INDEX IF NOT EXISTS usage_events_user_created_idx ON usage_events (user_id, created_at)`;
await sql`CREATE INDEX IF NOT EXISTS usage_events_run_idx ON usage_events (run_id)`;

const viaChannel = await sql`UPDATE pipeline_runs r SET user_id = c.user_id
  FROM channels c WHERE r.channel_id = c.id AND r.user_id IS NULL`;
const viaCompetitor = await sql`UPDATE pipeline_runs r SET user_id = ca.user_id
  FROM competitor_accounts ca WHERE r.competitor_account_id = ca.id AND r.user_id IS NULL`;

const verify = await sql`SELECT
  (SELECT count(*) FROM pipeline_runs) AS runs,
  (SELECT count(*) FROM pipeline_runs WHERE user_id IS NOT NULL) AS attributed,
  (SELECT count(*) FROM usage_events) AS events`;
console.log("backfilled via channel:", viaChannel.count, "| via competitor:", viaCompetitor.count);
console.log("verify:", verify[0]);
await sql.end();
