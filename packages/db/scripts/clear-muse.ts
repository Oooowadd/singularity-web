import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { museMonitorVideos } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const cid = process.argv[2]!;
  // Only clear monitor_videos (the dedupe key). Ideas have FKs from poet_scripts;
  // keep them — they'll just point to nullable source_video_id after re-run.
  const v = await db
    .delete(museMonitorVideos)
    .where(eq(museMonitorVideos.channelId, cid))
    .returning({ id: museMonitorVideos.id });
  console.log(`cleared ${v.length} monitor videos for ${cid}`);
} finally { await c.end(); }
