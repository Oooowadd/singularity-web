import { createReadStream, createWriteStream, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import Groq from "groq-sdk";

import { getAudioStreams, type AudioStream } from "./tikhub";

const GROQ_FILE_LIMIT_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 180_000;

let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!_groq) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY not set in env");
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

function pickSmallestAudio(streams: AudioStream[]): AudioStream | null {
  const withUrl = streams.filter((s) => s.url);
  if (withUrl.length === 0) return null;
  return [...withUrl].sort(
    (a, b) => Number(a.content_length ?? Infinity) - Number(b.content_length ?? Infinity),
  )[0]!;
}

function extensionForMime(mime?: string): string {
  if (!mime) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "m4a";
}

async function downloadToTemp(url: string, ext: string): Promise<string> {
  const dest = join(
    tmpdir(),
    `singularity-asr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`audio download HTTP ${res.status}`);
    // pipeline() vs pipe()+finished() so AbortError can't escape as unhandled 'error'
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
    return dest;
  } finally {
    clearTimeout(timeout);
  }
}

export type AsrResult = {
  text: string;
  detectedLanguage?: string;
  durationSec?: number;
};

export type AsrPhase = "selecting" | "downloading" | "transcribing";

/**
 * Transcribe a YouTube video's audio via Groq Whisper large-v3.
 * Returns null on any recoverable failure (no streams, oversize, expired URL,
 * Groq error) so the caller can leave the transcript empty without aborting.
 */
export async function transcribeYoutubeVideo(
  videoId: string,
  opts: {
    onPhase?: (phase: AsrPhase, info?: { bytes?: number }) => void;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  } = {},
): Promise<AsrResult | null> {
  const { onPhase, logger } = opts;
  let tempPath: string | null = null;
  try {
    onPhase?.("selecting");
    const streams = await getAudioStreams(videoId);
    if (streams.length === 0) {
      logger?.warn(`ASR ${videoId}: no audio streams`);
      return null;
    }
    const best = pickSmallestAudio(streams);
    if (!best?.url) {
      logger?.warn(`ASR ${videoId}: no usable audio URL`);
      return null;
    }
    const declaredSize = Number(best.content_length ?? 0);
    if (declaredSize > GROQ_FILE_LIMIT_BYTES) {
      logger?.warn(`ASR ${videoId}: declared ${declaredSize}B > 25MB`);
      return null;
    }

    onPhase?.("downloading");
    tempPath = await downloadToTemp(best.url, extensionForMime(best.mime_type));
    const actualSize = statSync(tempPath).size;
    if (actualSize > GROQ_FILE_LIMIT_BYTES) {
      logger?.warn(`ASR ${videoId}: actual ${actualSize}B > 25MB`);
      return null;
    }
    logger?.info(`ASR ${videoId}: downloaded ${actualSize} bytes`);

    onPhase?.("transcribing", { bytes: actualSize });
    const result = await getGroq().audio.transcriptions.create({
      file: createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });
    const v = result as unknown as { text?: string; language?: string; duration?: number };
    const text = (v.text ?? "").trim();
    if (!text) {
      logger?.warn(`ASR ${videoId}: empty Whisper response`);
      return null;
    }
    return { text, detectedLanguage: v.language, durationSec: v.duration };
  } catch (err) {
    logger?.warn(`ASR ${videoId} failed: ${(err as Error).message?.slice(0, 200) ?? err}`);
    return null;
  } finally {
    if (tempPath) {
      try {
        unlinkSync(tempPath);
      } catch {
        /* already gone */
      }
    }
  }
}
