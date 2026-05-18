// TikHub rate limit: 1 req/sec per route — caller paces across same endpoint.
const BASE = "https://api.tikhub.io";

function key(): string {
  const k = process.env.TIKHUB_API_KEY;
  if (!k) throw new Error("TIKHUB_API_KEY not set in env");
  return k;
}

async function get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${endpoint}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key()}`, accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikHub ${endpoint} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { code?: number; data?: T; detail?: unknown };
  if (json.code && json.code !== 200) {
    throw new Error(`TikHub ${endpoint} code ${json.code}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return (json.data ?? json) as T;
}

// ── YouTube ─────────────────────────────────────────────────────────

export type YouTubeChannelMeta = {
  channel_id: string;
  channel_name?: string;
  description?: string;
  subscriber_count?: number;
  thumbnail_url?: string;
};

export async function resolveChannelId(channelUrl: string): Promise<string> {
  const data = await get<{ channel_id: string }>(
    "/api/v1/youtube/web/get_channel_id_v2",
    { channel_url: channelUrl },
  );
  return data.channel_id;
}

export async function getChannelInfo(channelId: string): Promise<YouTubeChannelMeta> {
  return get<YouTubeChannelMeta>("/api/v1/youtube/web/get_channel_info", {
    channel_id: channelId,
  });
}

export type YouTubeVideoRef = {
  video_id: string;
  title: string;
  url?: string;
  view_count?: number;
  duration?: string; // human-readable like "21:13"
  thumbnail?: string;
  published_time?: string;
  description?: string;
  is_live?: boolean;
};

export async function getChannelVideos(channelId: string): Promise<YouTubeVideoRef[]> {
  const data = await get<{ videos?: YouTubeVideoRef[]; continuation_token?: string }>(
    "/api/v1/youtube/web_v2/get_channel_videos",
    { channel_id: channelId },
  );
  return (data.videos ?? []).filter((v) => v.video_id && !v.is_live);
}

export type CaptionTrack = {
  language_code: string;
  language_name: string;
  base_url: string;
  is_translatable?: boolean;
  kind?: string;
};

export type YouTubeVideoInfo = {
  video_id: string;
  title: string;
  url: string;
  views: number;
  duration_sec: number;
  thumbnail_url: string;
  channel_id: string;
  channel_name: string;
  description?: string;
  published_at?: string;
  captions: CaptionTrack[];
};

// `/web_v2/get_video_info` returns flat metadata + captions inline; v3 returns raw InnerTube — avoid.
export async function getVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  const d = await get<{
    video_id?: string;
    title?: string;
    video_url?: string;
    view_count?: number | string;
    length_seconds?: number | string;
    thumbnails?: Array<{ url: string; width?: number; height?: number }>;
    channel_id?: string;
    author?: string;
    description?: string;
    upload_date?: string;
    publish_date?: string;
    captions?: CaptionTrack[];
  }>("/api/v1/youtube/web_v2/get_video_info", { video_id: videoId });

  const largestThumb =
    d.thumbnails && d.thumbnails.length > 0
      ? [...d.thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
      : undefined;

  const viewsNum = typeof d.view_count === "number" ? d.view_count : Number(d.view_count) || 0;
  const lenNum =
    typeof d.length_seconds === "number" ? d.length_seconds : Number(d.length_seconds) || 0;

  return {
    video_id: d.video_id ?? videoId,
    title: d.title ?? "",
    url: d.video_url ?? `https://www.youtube.com/watch?v=${videoId}`,
    views: viewsNum,
    duration_sec: lenNum,
    thumbnail_url: largestThumb?.url ?? "",
    channel_id: d.channel_id ?? "",
    channel_name: d.author ?? "",
    description: d.description,
    published_at: d.publish_date ?? d.upload_date,
    captions: d.captions ?? [],
  };
}

// Standalone captions call — getVideoInfo already includes them; use only when metadata isn't needed.
export async function getCaptionsManifest(videoId: string): Promise<CaptionTrack[]> {
  const data = await get<{ captions?: CaptionTrack[] }>(
    "/api/v1/youtube/web_v2/get_video_captions_v2",
    { video_id: videoId },
  );
  return data.captions ?? [];
}

// fmt=srv3 → `<p>`; bare URL → `<text>`. Some base_urls only honor one — parse both, return first non-empty.
export async function fetchTranscriptText(baseUrl: string): Promise<string> {
  const fetchOne = async (url: string): Promise<string> => {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`YouTube timedtext HTTP ${res.status}`);
    return res.text();
  };

  const parse = (xml: string): string => {
    const pLines = xml.match(/<p[^>]*>([\s\S]*?)<\/p>/g) ?? [];
    const textLines = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g) ?? [];
    const lines = pLines.length > 0 ? pLines : textLines;
    return lines
      .map((line) => line.replace(/<[^>]*>/g, ""))
      .join("\n")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
      .trim();
  };

  const urlWithFmt = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=srv3`;
  const xml = await fetchOne(urlWithFmt);
  const text = parse(xml);
  if (text.length > 0) return text;
  if (urlWithFmt !== baseUrl) {
    const fallback = await fetchOne(baseUrl);
    return parse(fallback);
  }
  return "";
}

// Falls through tracks on empty fetch — some YouTube base_urls return 0-byte XML.
export async function transcriptFromTracks(
  tracks: CaptionTrack[],
  preferLangs: string[] = ["en", "zh", "zh-CN", "zh-TW"],
): Promise<{ text: string; languageCode: string } | null> {
  if (tracks.length === 0) return null;
  const sorted = [...tracks].sort((a, b) => {
    const ai = preferLangs.indexOf(a.language_code);
    const bi = preferLangs.indexOf(b.language_code);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  for (const track of sorted) {
    try {
      const text = await fetchTranscriptText(track.base_url);
      if (text.length > 0) return { text, languageCode: track.language_code };
    } catch {
      /* try next track */
    }
  }
  return null;
}

export async function getVideoWithTranscript(
  videoId: string,
  preferLangs: string[] = ["en", "zh", "zh-CN", "zh-TW"],
): Promise<{
  info: YouTubeVideoInfo;
  transcript: { text: string; languageCode: string } | null;
}> {
  const info = await getVideoInfo(videoId);
  const transcript = await transcriptFromTracks(info.captions, preferLangs);
  return { info, transcript };
}

export type AudioStream = {
  itag: number;
  mime_type: string;
  url: string;
  audio_quality?: string;
  content_length?: string;
};

export async function getAudioStreams(videoId: string): Promise<AudioStream[]> {
  const data = await get<{
    adaptive_formats?: AudioStream[];
    streams?: AudioStream[];
  }>("/api/v1/youtube/web_v2/get_video_streams_v2", { video_id: videoId });
  const all = [...(data.adaptive_formats ?? []), ...(data.streams ?? [])];
  return all.filter((s) => s.mime_type?.startsWith("audio/"));
}

// ── Xiaohongshu ─────────────────────────────────────────────────────

export type XhsNoteRef = {
  id: string;
  note_id?: string;
  title?: string;
  type?: "video" | "image" | string;
  user_id?: string;
};

export async function searchXhsNotes(keyword: string): Promise<XhsNoteRef[]> {
  const data = await get<{ items?: XhsNoteRef[] }>(
    "/api/v1/xiaohongshu/app_v2/search_notes",
    { keyword },
  );
  return data.items ?? [];
}
