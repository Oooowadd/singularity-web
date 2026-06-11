// Deterministic fallback test: bogus proxy forces the yt-dlp leg to fail, the
// YouTube Data API leg must serve the listing. Read-only.
// Run: pnpm --filter @singularity/db exec tsx scripts/probe-listing-fallback.ts <channelUrl>
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { listChannelVideos } = await import("@singularity/shared/clients/ytdlp");

const url = process.argv[2] ?? "https://www.youtube.com/@lyi";
const t0 = Date.now();
const videos = await listChannelVideos(url, 5, "http://127.0.0.1:1", {
  info: (m) => console.log(`[info] ${m}`),
  warn: (m) => console.log(`[warn] ${m}`),
});
console.log(`rows=${videos.length} in ${(Date.now() - t0) / 1000}s`);
for (const v of videos)
  console.log(`  ${v.video_id}  ${v.duration_sec}s  views=${v.views}  ${v.title.slice(0, 40)}  pub=${v.published_at}`);
