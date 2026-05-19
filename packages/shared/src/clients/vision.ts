// Vision-based thumbnail analysis via Anthropic Claude Sonnet.
// DeepSeek V4 is text-only; we use Claude here purely for image understanding.

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

let _anthropic: ReturnType<typeof createAnthropic> | null = null;

function getAnthropic() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in env");
    _anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export type ThumbnailAnalysis = {
  description: string;
  whyItWorks: string;
};

const ZH_INSTRUCTION = `你是 YouTube 缩略图视觉分析师。请观察这张缩略图，输出严格的 JSON：

{
  "description": "用 2-3 句中文描述图片实际看到的内容（颜色、元素布局、文字、人物表情、视觉钩子）",
  "why_it_works": "用 2-3 句中文说明这张缩略图为什么有效（点击诱因、情绪触发、对比手法）"
}

只返回 JSON，不要 markdown 代码块。所有描述基于你真实看到的画面，不要根据标题猜测。`;

const EN_INSTRUCTION = `You are a YouTube thumbnail visual analyst. Observe this thumbnail and output strict JSON:

{
  "description": "2-3 sentences describing what's actually visible (colors, layout, text, expressions, visual hooks)",
  "why_it_works": "2-3 sentences explaining why this thumbnail works (click triggers, emotional cues, contrast)"
}

Return JSON only, no markdown fences. All descriptions must be based on what you actually see, not inferred from the title.`;

function parseLenient(raw: string): { description?: unknown; why_it_works?: unknown } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function analyzeThumbnail(
  thumbnailUrl: string,
  language: "en" | "zh" = "zh",
): Promise<ThumbnailAnalysis | null> {
  return analyzeImageStack([thumbnailUrl], language);
}

const ZH_STACK_INSTRUCTION = `你是小红书图文笔记视觉分析师。下面是该笔记的多张图片（按顺序），请综合所有图片，输出严格的 JSON：

{
  "description": "用 3-4 句中文综合描述全部图片：第 1 张作为封面起到什么钩子作用、整组图片的视觉风格（排版/配色/字体/拼贴方式）、画面里的核心元素和文字",
  "why_it_works": "用 3-4 句中文说明为什么这组图片有效：封面如何抓住用户、整套图片如何带动用户滑下去看完、有哪些情绪/认知触发"
}

只返回 JSON，不要 markdown 代码块。所有描述基于你真实看到的画面。`;

const EN_STACK_INSTRUCTION = `You are a Xiaohongshu image-post visual analyst. Below are the post's images in order. Synthesize across all of them and output strict JSON:

{
  "description": "3-4 sentences synthesizing all images: how the first image hooks as a cover, the visual style of the whole set (layout/palette/typography/collage), and the core visible elements and text",
  "why_it_works": "3-4 sentences explaining why this image set works: how the cover grabs the user, how the sequence keeps them swiping, and the emotional/cognitive triggers"
}

Return JSON only, no markdown fences. All descriptions must be based on what you actually see.`;

// Multi-image vision for XHS image-posts (1-10 images). Passes up to 9 images
// in one call so Claude can synthesize the whole gallery instead of judging
// only the cover. Falls back to single-image instruction when given just one.
export async function analyzeImageStack(
  urls: string[],
  language: "en" | "zh" = "zh",
): Promise<ThumbnailAnalysis | null> {
  try {
    const clipped = urls.filter(Boolean).slice(0, 9);
    if (clipped.length === 0) return null;
    const single = clipped.length === 1;
    const instruction = single
      ? language === "zh"
        ? ZH_INSTRUCTION
        : EN_INSTRUCTION
      : language === "zh"
        ? ZH_STACK_INSTRUCTION
        : EN_STACK_INSTRUCTION;
    const result = await generateText({
      model: getAnthropic()("claude-sonnet-4-6"),
      maxOutputTokens: single ? 800 : 1200,
      maxRetries: 2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            ...clipped.map((u) => ({ type: "image" as const, image: new URL(u) })),
          ],
        },
      ],
    });
    const parsed = parseLenient(result.text);
    if (!parsed) return null;
    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    const whyItWorks =
      typeof parsed.why_it_works === "string" ? parsed.why_it_works.trim() : "";
    if (!description && !whyItWorks) return null;
    return { description, whyItWorks };
  } catch {
    return null;
  }
}
