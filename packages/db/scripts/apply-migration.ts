import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  const text = readFileSync(process.argv[2]!, "utf-8");
  for (const stmt of text.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
    console.log("EXEC:", stmt.slice(0, 80));
    await sql.unsafe(stmt);
  }
  console.log("DONE");
} finally { await sql.end(); }
