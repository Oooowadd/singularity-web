import { generateText } from "ai";

import { llm } from "../../clients/llm";
import { buildTopicAnalysisPrompt } from "../../prompts/poet";
import { formatReferencesBlock, type ScriptReference } from "./scriptWriter";

export type TopicAnalysis = {
  storyAngle: string;
  factsAndData: string;
  verbatimFacts: string;
  whySimilar: string;
  viralTrigger: string;
};

export type AnalyzeTopicArgs = {
  topic: string;
  references: ScriptReference[] | null | undefined;
  bibleText: string;
  sopText: string;
  language: "en" | "zh";
};

function parseLenientJson(rawText: string): unknown {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return null;
  try {
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function toText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((s) => s.length > 0)
      .map((s) => (s.startsWith("- ") ? s : `- ${s}`))
      .join("\n");
  }
  return String(value).trim();
}

export async function analyzeTopic(args: AnalyzeTopicArgs): Promise<TopicAnalysis> {
  const prompt = buildTopicAnalysisPrompt({
    channelBible: args.bibleText,
    sopReference: args.sopText,
    topic: args.topic,
    referencesContext: formatReferencesBlock(args.references ?? null),
    language: args.language,
  });

  let data: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateText({
      model: llm("pro"),
      prompt,
      temperature: 0.6,
      maxOutputTokens: 6144,
      maxRetries: 2,
    });
    const parsed = parseLenientJson(result.text);
    if (parsed && typeof parsed === "object") {
      data = parsed as Record<string, unknown>;
      break;
    }
  }

  return {
    storyAngle: toText(data.story_angle),
    factsAndData: toText(data.facts_and_data),
    verbatimFacts: toText(data.verbatim_facts),
    whySimilar: toText(data.why_similar),
    viralTrigger: toText(data.viral_trigger),
  };
}
