import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { channels } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const [ch] = await db.select().from(channels).where(eq(channels.id, "631c9b53-5d4a-44fc-b45c-416e8df52089"));
  console.log(`name: ${ch?.name}`);
  console.log(`desc: ${ch?.description ?? "<empty>"}`);
} finally { await c.end(); }
