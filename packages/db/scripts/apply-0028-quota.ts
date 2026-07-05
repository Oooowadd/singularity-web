// Idempotent apply for 0028: quota counters + redemption codes + audit.
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: new URL("../../../.env.local", import.meta.url).pathname });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

await sql`CREATE TABLE IF NOT EXISTS usage_counters (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period text NOT NULL,
  contents_used integer NOT NULL DEFAULT 0,
  generations_used integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
)`;

await sql`CREATE TABLE IF NOT EXISTS redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  "grant" jsonb NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
)`;

await sql`CREATE TABLE IF NOT EXISTS code_redemptions (
  code_id uuid NOT NULL REFERENCES redemption_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (code_id, user_id)
)`;

await sql`CREATE TABLE IF NOT EXISTS quota_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL,
  code_id uuid,
  accounts_delta integer NOT NULL DEFAULT 0,
  contents_delta integer NOT NULL DEFAULT 0,
  generations_delta integer NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
)`;

const verify = await sql`SELECT
  to_regclass('usage_counters') AS counters,
  to_regclass('redemption_codes') AS codes,
  to_regclass('code_redemptions') AS redemptions,
  to_regclass('quota_adjustments') AS adjustments`;
console.log("verify:", verify[0]);
await sql.end();
