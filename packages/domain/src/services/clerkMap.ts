import { generateText } from "ai";

import { llm } from "@singularity/integrations/clients/llm";
import { buildVideoMapSummaryPrompt } from "@singularity/prompts/clerk";

// MAP step of the SOP map-reduce: distill one video (transcript + structured analysis)
// into a compact reusable-pattern summary. Flash is enough for per-video distillation
// (matches the per-video analysis tier) and keeps the fan-out cheap. Throws on failure
// so the caller can fall back to a structured-field render for just that video.
export async function summarizeVideoForSop(args: {
  title: string;
  views: number | null;
  durationSec: number | null;
  contentType?: "video" | "xhs_image" | "xhs_video";
  transcript: string | null;
  analysis: string;
  language?: "en" | "zh";
  logger?: { info?: (m: string) => void; warn?: (m: string) => void };
}): Promise<string> {
  const prompt = buildVideoMapSummaryPrompt({
    title: args.title,
    views: args.views,
    durationSec: args.durationSec,
    contentType: args.contentType,
    transcript: args.transcript,
    analysis: args.analysis,
    language: args.language,
  });
  const result = await generateText({
    model: llm("flash"),
    prompt,
    maxOutputTokens: 800,
    temperature: 0.3,
    maxRetries: 2,
  });
  const out = result.text.trim();
  if (!out) throw new Error("map summary returned empty");
  args.logger?.info?.(`SOP map summary: ${args.title.slice(0, 50)} → ${out.length} chars`);
  return out;
}
