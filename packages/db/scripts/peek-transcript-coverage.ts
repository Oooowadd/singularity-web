// Read-only: transcript coverage for a channel's latest analyzed videos.
// Run: pnpm --filter @goooose/db exec tsx scripts/peek-transcript-coverage.ts <channelSlug>
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const slug = process.argv[2] ?? "linyi";
try {
  const rows = await sql`
    SELECT cv.title, cv.transcript_source,
      (cv.transcript IS NOT NULL AND length(cv.transcript) > 0) AS has_transcript,
      cv.analyzed_at
    FROM clerk_videos cv
    JOIN channels ch ON ch.id = cv.channel_id
    WHERE ch.slug = ${slug}
    ORDER BY cv.analyzed_at DESC NULLS LAST LIMIT 12`;
  for (const r of rows)
    console.log(
      `${r.has_transcript ? "✓" : "✗"} [${r.transcript_source ?? "none"}] ${String(r.title).slice(0, 40)}  ${r.analyzed_at ?? ""}`,
    );
  if (rows.length === 0) console.log("(no rows)");
} finally {
  await sql.end();
}
