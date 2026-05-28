import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { channels, type CompetitorRef } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const id = process.argv[2]!;
  const [ch] = await db.select().from(channels).where(eq(channels.id, id));
  if (!ch) { console.error("no channel"); process.exit(1); }
  console.log(`name: ${ch.name}`);
  console.log(`platform: ${ch.platform}`);
  console.log(`description: ${ch.description?.slice(0, 200) ?? "<empty>"}`);
  const competitors = (ch.competitors ?? []) as CompetitorRef[];
  console.log(`competitors: ${competitors.length}`);
  for (const c of competitors) console.log(`  - ${c.name ?? c.url}`);
} finally { await c.end(); }
