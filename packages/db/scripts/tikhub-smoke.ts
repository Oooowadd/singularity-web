/**
 * TikHub D5 comprehensive smoke test — verifies every endpoint we'll need
 * for Clerk (YouTube analyzer), Muse (competitor monitor), and XHS support.
 *
 * Run: pnpm --filter @singularity/db tikhub-smoke
 *
 * Pacing: 1.2s between calls to avoid the 1/sec per-route rate limit.
 * Total cost: ~$0.025 across ~13 calls.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const TOKEN = process.env.TIKHUB_API_KEY;
if (!TOKEN) throw new Error("TIKHUB_API_KEY not set");

const HEADERS = { Authorization: `Bearer ${TOKEN}`, accept: "application/json" };
const BASE = "https://api.tikhub.io";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Result = {
  category: string;
  endpoint: string;
  params: Record<string, string>;
  ok: boolean;
  ms: number;
  preview: string;
  cost?: string;
};

const results: Result[] = [];

async function call(
  category: string,
  endpoint: string,
  params: Record<string, string> = {},
  cost?: string,
): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${endpoint}${qs ? `?${qs}` : ""}`;
  const t0 = Date.now();
  let body: unknown = null;
  let ok = false;
  let preview = "";
  try {
    const res = await fetch(url, { headers: HEADERS });
    ok = res.ok;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    preview = JSON.stringify(body).slice(0, 200);
    if (!ok) preview = `HTTP ${res.status}: ${preview}`;
  } catch (e) {
    preview = `error: ${(e as Error).message}`;
  }
  const ms = Date.now() - t0;
  results.push({ category, endpoint, params, ok, ms, preview, cost });
  console.log(`  [${ok ? "✓" : "✗"}] ${endpoint} (${ms}ms) ${cost ? `· ${cost}` : ""}`);
  console.log(`      ${preview}`);
  return body;
}

// Pick<T, K> for narrow typing of pulled fields
type Maybe<T> = T | undefined;
type WithData<T> = { data?: T };

async function main() {
  console.log(`Token: ${TOKEN!.slice(0, 6)}…${TOKEN!.slice(-4)}\n`);
  console.log(`Pacing: 1.2s between requests to respect 1/sec per-route limit\n`);

  //
  // === YouTube — for Clerk (analyze user's channel) + Muse (competitor monitor) ===
  //
  console.log("═══ YouTube — Clerk + Muse path ═══\n");

  // 1. Channel handle/URL → channel ID
  console.log("1. Resolve channel handle → ID");
  const handleRes = (await call(
    "youtube-resolve",
    "/api/v1/youtube/web/get_channel_id_v2",
    { channel_url: "https://www.youtube.com/@LinusTechTips" },
    "$0.001",
  )) as Maybe<WithData<{ channel_id?: string }>>;
  const channelId =
    handleRes?.data?.channel_id ?? "UCXuqSBlHAE6Xw-yeJA0Tunw"; // fallback
  console.log(`    → channelId = ${channelId}\n`);
  await sleep(1200);

  // 2. Channel info (description, sub count)
  console.log("2. Channel info");
  await call(
    "youtube-channel-meta",
    "/api/v1/youtube/web/get_channel_info",
    { channel_id: channelId },
    "$0.001",
  );
  await sleep(1200);

  // 3. Channel videos (latest)
  console.log("3. Channel videos list");
  const videosRes = (await call(
    "youtube-channel-videos",
    "/api/v1/youtube/web/get_channel_videos_v3",
    { channel_id: channelId },
    "$0.001",
  )) as Maybe<WithData<{ videos?: Array<{ video_id?: string }> }>>;
  // Try to extract a real video id; fall back to a known captioned one
  const sampleVideoId =
    videosRes?.data?.videos?.[0]?.video_id ?? "dQw4w9WgXcQ";
  console.log(`    → sample videoId = ${sampleVideoId}\n`);
  await sleep(1200);

  // 4. Video info (metadata)
  console.log("4. Video info (metadata)");
  await call(
    "youtube-video-meta",
    "/api/v1/youtube/web/get_video_info_v3",
    { video_id: sampleVideoId },
    "$0.001",
  );
  await sleep(1200);

  // 5. Captions manifest (transcript path)
  console.log("5. Captions manifest");
  const capsRes = (await call(
    "youtube-captions-manifest",
    "/api/v1/youtube/web_v2/get_video_captions_v2",
    { video_id: "dQw4w9WgXcQ" },
    "$0.001",
  )) as Maybe<
    WithData<{ captions?: Array<{ language_code?: string; base_url?: string }> }>
  >;
  const captionTracks = capsRes?.data?.captions ?? [];
  console.log(`    → ${captionTracks.length} tracks\n`);
  await sleep(1200);

  // 6. Fetch transcript text directly from YouTube base_url (no TikHub charge)
  if (captionTracks[0]?.base_url) {
    console.log("6. Direct YouTube timedtext fetch (free, via signed URL)");
    const t0 = Date.now();
    try {
      const res = await fetch(captionTracks[0].base_url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const text = await res.text();
      const lines = text.split("\n").length;
      const preview = text.slice(0, 200).replace(/\n/g, " ⏎ ");
      console.log(
        `  [${res.ok ? "✓" : "✗"}] direct timedtext (${Date.now() - t0}ms) · free`,
      );
      console.log(`      ${text.length} chars, ${lines} lines`);
      console.log(`      ${preview}\n`);
      results.push({
        category: "youtube-transcript-text",
        endpoint: "[direct YouTube timedtext]",
        params: {},
        ok: res.ok,
        ms: Date.now() - t0,
        preview: `${text.length}c, sample: ${preview}`,
        cost: "free",
      });
    } catch (e) {
      console.log(`  error: ${(e as Error).message}\n`);
    }
  }
  await sleep(1200);

  // 7. Audio/video streams (ASR fallback for no-caption videos)
  console.log("7. Video streams (audio for ASR fallback)");
  await call(
    "youtube-streams",
    "/api/v1/youtube/web_v2/get_video_streams_v2",
    { video_id: "dQw4w9WgXcQ" },
    "$0.003",
  );
  await sleep(1200);

  // 8. Search videos (Muse keyword monitoring)
  console.log("8. Video search (Muse keyword monitoring)");
  await call(
    "youtube-search",
    "/api/v1/youtube/web/search_video",
    { search_query: "leica camera review" },
    "$0.001",
  );
  await sleep(1200);

  // 9. Trending videos (Muse "viral" detection)
  console.log("9. Trending videos");
  await call(
    "youtube-trending",
    "/api/v1/youtube/web/get_trending_videos",
    {},
    "$0.001",
  );
  await sleep(1200);

  //
  // === XHS — Muse XHS monitoring + Clerk XHS ===
  //
  console.log("\n═══ XHS — XHS path ═══\n");

  // 10. Search notes (app_v2 confirmed working; web_v3 unstable)
  console.log("10. XHS search notes (app_v2)");
  const xhsSearchRes = (await call(
    "xhs-search",
    "/api/v1/xiaohongshu/app_v2/search_notes",
    { keyword: "徕卡 m11" },
    "$0.010",
  )) as Maybe<
    WithData<{ items?: Array<{ id?: string; note_id?: string }> }>
  >;
  // Try to extract a note_id for detail call
  const xhsNoteId =
    xhsSearchRes?.data?.items?.[0]?.note_id ??
    xhsSearchRes?.data?.items?.[0]?.id ??
    null;
  console.log(`    → sample note_id = ${xhsNoteId ?? "(none found)"}\n`);
  await sleep(1200);

  // 11. XHS note detail (only if we got an id)
  if (xhsNoteId) {
    console.log("11. XHS note detail");
    await call(
      "xhs-note-detail",
      "/api/v1/xiaohongshu/web_v3/fetch_note_detail",
      { note_id: xhsNoteId },
      "$0.010",
    );
    await sleep(1200);
  } else {
    console.log("11. (skipped — no note_id from search)");
  }

  // 12. Trending / hot list (web_v2 confirmed working)
  console.log("12. XHS hot list");
  await call(
    "xhs-trending",
    "/api/v1/xiaohongshu/web_v2/fetch_hot_list",
    {},
    "$0.010",
  );
  await sleep(1200);

  //
  // === Summary ===
  //
  console.log("\n═══ Summary ═══\n");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`Total: ${results.length}, passed: ${passed}, failed: ${failed}`);
  console.log();
  console.log("category".padEnd(30) + "ms".padEnd(8) + "cost".padEnd(10) + "ok");
  console.log("─".repeat(70));
  for (const r of results) {
    console.log(
      r.category.padEnd(30) +
        String(r.ms).padEnd(8) +
        (r.cost ?? "—").padEnd(10) +
        (r.ok ? "✓" : "✗"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
