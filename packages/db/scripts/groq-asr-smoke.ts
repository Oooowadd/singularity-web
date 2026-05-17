/**
 * Groq Whisper ASR smoke test:
 *   Test A: known-content TTS sample → verify SDK + key + accuracy
 *   Test B: end-to-end no-caption YouTube video
 *           → TikHub streams_v2 → download audio chunk → Groq Whisper
 *
 * Confirms the full ASR fallback path for Clerk pipeline.
 *
 * Run: pnpm --filter @singularity/db exec tsx scripts/groq-asr-smoke.ts
 */
import { createReadStream, createWriteStream, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import Groq from "groq-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const GROQ_KEY = process.env.GROQ_API_KEY;
const TIKHUB_KEY = process.env.TIKHUB_API_KEY;
if (!GROQ_KEY) throw new Error("GROQ_API_KEY not set");
if (!TIKHUB_KEY) throw new Error("TIKHUB_API_KEY not set");

const groq = new Groq({ apiKey: GROQ_KEY });

async function testA() {
  console.log("═══ Test A: known-content TTS sample ═══");
  const path = "/tmp/groq-test.mp3";
  console.log(`Audio: ${path} (${statSync(path).size} bytes)`);
  const t0 = Date.now();
  const result = await groq.audio.transcriptions.create({
    file: createReadStream(path),
    model: "whisper-large-v3",
  });
  const ms = Date.now() - t0;
  console.log(`Took ${ms}ms`);
  console.log(`Output: ${result.text}`);
  console.log();
  return result;
}

type StreamsResponse = {
  code?: number;
  data?: {
    streams?: Array<{
      itag?: number;
      mime_type?: string;
      url?: string;
      audio_track?: { audio_is_default?: boolean; display_name?: string };
      audio_quality?: string;
      content_length?: string;
    }>;
    adaptive_formats?: Array<{
      itag?: number;
      mime_type?: string;
      url?: string;
      audio_quality?: string;
      content_length?: string;
    }>;
  };
};

async function getAudioUrl(videoId: string): Promise<string | null> {
  console.log(`Fetching streams for ${videoId}…`);
  const res = await fetch(
    `https://api.tikhub.io/api/v1/youtube/web_v2/get_video_streams_v2?video_id=${videoId}`,
    { headers: { Authorization: `Bearer ${TIKHUB_KEY}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    console.log(`  TikHub error HTTP ${res.status}: ${body.slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as StreamsResponse;
  const adaptive = json.data?.adaptive_formats ?? [];
  const streams = json.data?.streams ?? [];

  // Look for audio-only streams (mime_type starts with "audio/")
  const audioOnly = [...adaptive, ...streams].filter((s) =>
    s.mime_type?.startsWith("audio/"),
  );
  console.log(`  Found ${audioOnly.length} audio-only formats`);
  for (const s of audioOnly.slice(0, 5)) {
    console.log(
      `    itag=${s.itag} mime=${s.mime_type} quality=${s.audio_quality ?? "?"} size=${s.content_length ?? "?"}`,
    );
  }

  // Pick smallest audio (medium quality is fine for Whisper)
  const sorted = audioOnly
    .filter((s) => s.url)
    .sort((a, b) => Number(a.content_length ?? Infinity) - Number(b.content_length ?? Infinity));
  return sorted[0]?.url ?? null;
}

async function downloadAudio(url: string, dest: string): Promise<number> {
  console.log(`Downloading audio…`);
  const t0 = Date.now();
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok || !res.body) {
    throw new Error(`download HTTP ${res.status}`);
  }
  const out = createWriteStream(dest);
  await finished(Readable.fromWeb(res.body as never).pipe(out));
  const bytes = statSync(dest).size;
  console.log(`  ${bytes} bytes in ${Date.now() - t0}ms`);
  return bytes;
}

async function testB() {
  console.log("═══ Test B: end-to-end YouTube → audio download → Groq Whisper ═══");
  // Rick Astley — confirmed streams_v2 returns audio formats
  // (Even though this video has captions, we use it to validate the ASR
  // fallback chain end-to-end. In production we only fall through to ASR
  // when captions_v2 returns 0 tracks.)
  const videoId = "dQw4w9WgXcQ";
  const url = await getAudioUrl(videoId);
  if (!url) {
    console.log("  Could not get audio URL — skipping ASR step");
    return;
  }
  console.log(`  audio url: ${url.slice(0, 80)}…`);

  const dest = "/tmp/groq-yt-audio.m4a";
  let bytes: number;
  try {
    bytes = await downloadAudio(url, dest);
  } catch (e) {
    console.log(`  download failed: ${(e as Error).message}`);
    return;
  }

  if (bytes > 25 * 1024 * 1024) {
    console.log(`  ${bytes} bytes exceeds Groq's 25MB limit; would need to chunk in production`);
    return;
  }

  console.log("Sending to Groq Whisper…");
  const t0 = Date.now();
  try {
    const result = await groq.audio.transcriptions.create({
      file: createReadStream(dest),
      model: "whisper-large-v3",
      language: "en",
    });
    const ms = Date.now() - t0;
    console.log(`Took ${ms}ms`);
    console.log(`Transcript (first 400 chars):`);
    console.log(`  ${result.text.slice(0, 400)}`);
    console.log(`Total length: ${result.text.length} chars`);
  } catch (e) {
    console.log(`  Whisper error: ${(e as Error).message}`);
  }
}

async function main() {
  await testA();
  await testB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
