-- Round 4 Muse triage: soft-delete an idea (已忽略). Additive, nullable — safe and reversible.
-- Hand-written raw SQL (drizzle meta/journal drifted at 0014 — do NOT use drizzle-kit generate).
ALTER TABLE "muse_ideas" ADD COLUMN "dismissed_at" timestamp with time zone;
