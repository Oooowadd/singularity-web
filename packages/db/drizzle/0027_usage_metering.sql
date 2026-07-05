-- Usage metering: raw cost telemetry + per-run user attribution.
-- Additive. Hand-written (journal drifted at 0014). pipeline_runs.user_id
-- backfilled from channel/competitor owners for historical attribution.
ALTER TABLE "pipeline_runs" ADD COLUMN "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "run_id" uuid,
  "feature" text,
  "resource_type" text NOT NULL,
  "provider" text NOT NULL,
  "model" text,
  "input_tokens" integer,
  "cached_input_tokens" integer,
  "output_tokens" integer,
  "audio_seconds" real,
  "api_calls" integer,
  "estimated_cost_usd" numeric(12,6),
  "price_version" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "usage_events_user_created_idx" ON "usage_events" ("user_id", "created_at");
CREATE INDEX "usage_events_run_idx" ON "usage_events" ("run_id");

UPDATE "pipeline_runs" r SET "user_id" = c."user_id"
  FROM "channels" c WHERE r."channel_id" = c."id" AND r."user_id" IS NULL;
UPDATE "pipeline_runs" r SET "user_id" = ca."user_id"
  FROM "competitor_accounts" ca WHERE r."competitor_account_id" = ca."id" AND r."user_id" IS NULL;
