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
  const sops = await db.select().from(clerkSops).where(eq(clerkSops.runId, "bf255af0-dbb4-4d93-8479-4e4b32a82e54"));
  const type = process.argv[2] ?? "human";
  const s = sops.find((s) => s.sopType === type);
  if (!s) { console.error(`no ${type}`); process.exit(1); }
  console.log(s.contentMd);
} finally { await client.end(); }
