// Read-only: check a channel's SOPs for the no-transcript disclosure behavior.
// Run: pnpm --filter @singularity/db exec tsx scripts/peek-sop-disclosure.ts <channelSlug>
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const slug = process.argv[2] ?? "linyi";
try {
  // NB: regex backslashes must be doubled — a JS template literal eats \[ and \d,
  // turning the pattern into a match-anything bracket class (caused a false positive).
  const rows = await sql`
    SELECT cs.sop_type, cs.generated_at, length(cs.content_md) AS len,
      (cs.content_md ~ '\\[\\d+:\\d+\\]') AS has_timecodes,
      (cs.content_md LIKE '%字幕%' OR cs.content_md LIKE '%转写%' OR cs.content_md LIKE '%transcript%') AS mentions_transcript
    FROM clerk_sops cs JOIN channels ch ON ch.id = cs.channel_id
    WHERE ch.slug = ${slug} ORDER BY cs.generated_at DESC`;
  for (const r of rows)
    console.log(
      `${r.sop_type}  ${r.len} chars  timecodes=${r.has_timecodes}  mentions-transcript-coverage=${r.mentions_transcript}  ${r.generated_at}`,
    );
  if (rows.length === 0) console.log("(no SOPs yet)");
} finally {
  await sql.end();
}
