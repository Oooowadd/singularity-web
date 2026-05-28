import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { channels, museMonitorVideos } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  // Find channels that have muse_monitor_videos (i.e. have run Muse before)
  const channelsWithMuse = await db.execute<{ channel_id: string; name: string; count: number }>(`
    SELECT c.id as channel_id, c.name, COUNT(m.id)::int as count
    FROM channels c
    INNER JOIN muse_monitor_videos m ON m.channel_id = c.id
    GROUP BY c.id, c.name
    ORDER BY count DESC LIMIT 5
  `);
  console.log("Channels with prior Muse activity:");
  for (const r of channelsWithMuse) console.log(`  ${r.channel_id} | ${r.name} | ${r.count} monitor videos`);
} finally { await client.end(); }
