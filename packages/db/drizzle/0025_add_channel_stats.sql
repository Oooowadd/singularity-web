-- Own-account stats (follower count + freshness) so the account page can show + manually
-- refresh them, mirroring competitor_accounts. Additive, nullable. Hand-written (journal
-- drifted at 0014). (When channels is eventually dropped these move to own_accounts.)
ALTER TABLE "channels" ADD COLUMN "subscriber_count" integer;
ALTER TABLE "channels" ADD COLUMN "last_verified_at" timestamp with time zone;
