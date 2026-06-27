type SeriesDetectArgs = {
  channelName: string;
  videos: Array<{ title: string; duration_sec: number; views: number }>;
  language: "en" | "zh";
};

export function buildSeriesDetectPrompt(args: SeriesDetectArgs): string {
  const list = args.videos
    .map((v, i) => {
      const min = Math.round(v.duration_sec / 60);
      const mins = min > 0 ? `${min}min` : `${v.duration_sec}s`;
      return `${i + 1}. ${v.title} (${mins}, ${v.views} views)`;
    })
    .join("\n");

  const langInstruction =
    args.language === "zh"
      ? "Every value (series name, description) MUST be in Simplified Chinese (简体中文)."
      : "All values in English.";

  return `You are a YouTube content librarian. Given the recent videos from "${args.channelName}", cluster them into 3-7 content series.

A series is a coherent group of videos with similar:
- Topic / theme (e.g. "tutorial", "vlog", "product review", "industry commentary")
- Format / length (e.g. shorts vs long-form deep-dives)
- Title pattern (e.g. all starting with "How to…", numbered series)

## Videos

${list}

## Output

Return STRICT JSON only. No markdown fences. ${langInstruction}

\`\`\`
{
  "series": [
    {
      "name": "short, descriptive name (≤ 12 chars Chinese / 30 chars English)",
      "description": "1-sentence definition of what unites these videos",
      "video_indices": [1, 4, 7, ...]  // 1-indexed from the list above
    },
    ...
  ]
}
\`\`\`

Each video should belong to exactly one series. If a video is a one-off that fits no cluster, put it in a series called "其它" (Chinese) or "Other" (English).
`;
}

export type SeriesDetectResponse = {
  series: Array<{
    name: string;
    description: string;
    video_indices: number[];
  }>;
};
