// Triage probe: is YouTube channel listing broken at the yt-dlp/YouTube layer or
// only through the proxy egress? Runs the same listing twice — direct, then via a
// wealthproxies session from the prod pool. Read-only except proxy byte usage.
// Run: pnpm --filter @singularity/db exec tsx scripts/probe-ytdlp-listing.ts <channelUrl>
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { ensureYtdlpBinary, runYtdlp } = await import("@singularity/integrations/clients/ytdlp");
const { loadProxyPool } = await import("@singularity/db");

const channelUrl = process.argv[2] ?? "https://www.youtube.com/@lyi";
const target = `${channelUrl.replace(/\/+$/, "")}/videos`;

async function probe(label: string, extraArgs: string[]) {
  const t0 = Date.now();
  try {
    const r = await runYtdlp(
      [target, "--flat-playlist", "--dump-json", "--playlist-end", "3", ...extraArgs],
      90_000,
    );
    const lines = r.stdout.split("\n").filter((s) => s.trim().length > 0);
    console.log(
      `${label}: exit=${r.code} rows=${lines.length} ${(Date.now() - t0) / 1000}s stderr_tail=${r.stderr.trim().slice(-160)}`,
    );
  } catch (err) {
    console.log(`${label}: threw ${(err as Error).message?.slice(0, 200)} (${(Date.now() - t0) / 1000}s)`);
  }
}

await ensureYtdlpBinary();
await probe("direct (no proxy)", []);

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const pool = await loadProxyPool(db, { provider: "wealthproxies" });
  const session = pool.checkout({});
  console.log(`proxy session: ${session.provider}`);
  await probe("via wealthproxies", ["--proxy", session.url]);
} finally {
  await client.end();
}
