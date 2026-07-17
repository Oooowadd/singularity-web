import { Badge } from "@/components/ui/badge";

// Unknown sources read as "无字幕" — the competitor page's inline copy used to
// label them "AI 转写", contradicting the channel page for the same data.
export function TranscriptSourceBadge({
  source,
  hasTranscript,
}: {
  source: string | null;
  hasTranscript: boolean;
}) {
  if (!hasTranscript) {
    return <span className="font-mono text-[10px] text-muted-foreground">无字幕</span>;
  }
  if (source === "caption") {
    return <Badge variant="secondary" className="text-[10px]">字幕</Badge>;
  }
  if (source === "asr" || source === "xhs_asr" || source === "douyin_asr") {
    return <Badge variant="outline" className="text-[10px]">AI 转写</Badge>;
  }
  if (source === "xhs_text") {
    return <Badge variant="secondary" className="text-[10px]">正文</Badge>;
  }
  if (source === "douyin_text") {
    return <Badge variant="secondary" className="text-[10px]">文案</Badge>;
  }
  return <span className="font-mono text-[10px] text-muted-foreground">无字幕</span>;
}
