-- Round 4 SOP map-reduce: cache each video's distilled reusable-pattern summary so the SOP
-- reduce step works over compact summaries instead of full transcripts (bounded context).
-- Additive, nullable — safe and reversible. Hand-written raw SQL (journal drifted at 0014).
ALTER TABLE "clerk_videos" ADD COLUMN "sop_map_summary" text;
