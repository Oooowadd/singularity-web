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
  const v = await db.select().from(clerkVideos).where(eq(clerkVideos.platformVideoId, "69e3773e000000001f0054b2")).limit(1);
  const x = v[0]!;
  console.log(`type: ${x.contentType}`);
  console.log(`title: ${x.title}`);
  console.log(`thumbnail desc len: ${x.thumbnailDescription?.length ?? 0}`);
  console.log(`thumbnail desc head: ${x.thumbnailDescription?.slice(0, 250)}`);
  console.log(`cover diagnosis: ${x.coverDiagnosis?.slice(0, 200)}`);
  console.log(`framework: ${x.framework?.slice(0, 150)}`);
} finally { await c.end(); }
