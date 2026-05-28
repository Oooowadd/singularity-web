import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clerkSops } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const runId = process.argv[2]!;
  const sopType = process.argv[3] ?? "hottest";
  const sops = await db.select().from(clerkSops).where(eq(clerkSops.runId, runId));
  const s = sops.find((x) => x.sopType === sopType);
  if (!s) { console.error(`no ${sopType}`); process.exit(1); }
  console.log(s.contentMd);
} finally { await client.end(); }
