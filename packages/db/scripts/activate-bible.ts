import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { poetBible } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const id = process.argv[2]!;
  await db.update(poetBible).set({ isActive: false }).where(eq(poetBible.channelId, (await db.select().from(poetBible).where(eq(poetBible.id, id)).limit(1))[0]!.channelId));
  const r = await db.update(poetBible).set({ isActive: true }).where(eq(poetBible.id, id)).returning({ id: poetBible.id });
  console.log("activated:", r[0]?.id);
} finally { await c.end(); }
