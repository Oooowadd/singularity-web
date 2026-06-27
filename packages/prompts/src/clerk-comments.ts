type CommentSummaryArgs = {
  videoTitle: string;
  comments: Array<{ text: string; likes: number }>;
  language: "en" | "zh";
};

export function buildCommentsSummaryPrompt(args: CommentSummaryArgs): string {
  const list = args.comments
    .slice(0, 100)
    .map((c, i) => `${i + 1}. (${c.likes} likes) ${c.text}`)
    .join("\n");

  const langInstruction =
    args.language === "zh"
      ? "All string values must be in Simplified Chinese (简体中文)."
      : "All values in English.";

  return `You are summarizing viewer comments on a viral YouTube video titled "${args.videoTitle}". Extract structured insight about WHY viewers reacted.

## Comments (sorted by likes)

${list}

## Output

Return STRICT JSON. No markdown fences. ${langInstruction}

\`\`\`
{
  "top_themes": ["3-5 short phrases summarizing the dominant reactions"],
  "viral_triggers": ["2-4 specific moments/lines/elements viewers keep referencing"],
  "praise_examples": ["2-3 verbatim short quotes (≤ 120 chars each) representing what viewers love"],
  "criticisms": ["0-3 short phrases on what viewers pushed back on, empty array if none"],
  "audience_questions": ["0-3 short phrases on what viewers wanted MORE of, empty array if none"]
}
\`\`\`
`;
}

export type CommentsSummary = {
  top_themes: string[];
  viral_triggers: string[];
  praise_examples: string[];
  criticisms: string[];
  audience_questions: string[];
};
