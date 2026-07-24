-- Application-level server error capture (own-DB observability; no external provider).
-- Fed by Next.js instrumentation onRequestError. Append-only, additive.
CREATE TABLE "error_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "route" text,
  "method" text,
  "kind" text,
  "message" text NOT NULL,
  "stack" text,
  "digest" text,
  "meta" jsonb
);

CREATE INDEX "error_events_occurred_at_idx" ON "error_events" ("occurred_at");

-- Mirror 0030: RLS on, app connects as postgres (bypass); REST roles locked out.
ALTER TABLE "error_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "error_events" FROM anon, authenticated;
