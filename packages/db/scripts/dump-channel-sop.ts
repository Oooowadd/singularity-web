// Read-only: dump a channel's SOPs to /tmp for inspection.
// Run: pnpm --filter @goooose/db exec tsx scripts/dump-channel-sop.ts <channelSlug>
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const slug = process.argv[2] ?? "linyi";
try {
  const rows = await sql<{ sop_type: string; content_md: string }[]>`
    SELECT cs.sop_type, cs.content_md FROM clerk_sops cs
    JOIN channels ch ON ch.id = cs.channel_id WHERE ch.slug = ${slug}`;
  for (const r of rows) writeFileSync(`/tmp/${slug}-sop-${r.sop_type}.md`, r.content_md);
  console.log("dumped:", rows.map((r) => r.sop_type).join(", ") || "none");
} finally {
  await sql.end();
}
