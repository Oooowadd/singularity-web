import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clerkVideos } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const vids = await db.select({
    id: clerkVideos.platformVideoId,
    title: clerkVideos.title,
    type: clerkVideos.contentType,
    url: clerkVideos.url,
  }).from(clerkVideos).where(eq(clerkVideos.channelId, "890a4752-d79f-4419-b941-e932d6ddab96")).limit(5);
  for (const v of vids) console.log(`${v.type} | ${v.id} | ${v.title?.slice(0, 50)}`);
} finally { await c.end(); }
