// Read-only: measure connect + per-query RTT from this machine to the prod DB.
// Run: pnpm --filter @singularity/db exec tsx scripts/peek-db-latency.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const t0 = performance.now();
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
await sql`SELECT 1`;
console.log(`connect+first query: ${Math.round(performance.now() - t0)}ms`);
for (let i = 0; i < 5; i++) {
  const t = performance.now();
  await sql`SELECT 1`;
  console.log(`warm query ${i + 1}: ${Math.round(performance.now() - t)}ms`);
}
await sql.end();
