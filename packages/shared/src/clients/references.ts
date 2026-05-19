import {
  getVideoWithTranscript,
  type CaptionTrack,
} from "./tikhub";
import { transcribeYoutubeVideo } from "./asr";
import { extractXhsNoteId, getXhsNoteDetail } from "./xhs";

export { extractXhsNoteId };

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeVideoId(url: string): string | null {
  const s = url.trim();
  if (YT_ID_RE.test(s)) return s;
  try {
    const parsed = new URL(s);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "").slice(0, 11);
      if (YT_ID_RE.test(id)) return id;
    }
    if (host.includes("youtube.com")) {
      const cleanedPath = parsed.pathname.replace(/\/$/, "");
      if (cleanedPath === "/watch") {
        const v = parsed.searchParams.get("v") ?? "";
        if (YT_ID_RE.test(v)) return v;
      }
      const m = parsed.pathname.match(/\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1]!;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export type ReferenceInput = {
  kind: "youtube" | "xhs" | "text";
  url?: string;
  text?: string;
  title?: string;
};

export type FetchedReference = {
  type: string;
  url?: string;
  title: string;
  content: string;
  source?: string;
  error?: string;
  fetchedAt: string;
};

async function fetchYoutubeReference(ref: ReferenceInput): Promise<FetchedReference> {
  const url = ref.url ?? "";
  const videoId = extractYoutubeVideoId(url);
  const fetchedAt = new Date().toISOString();
  if (!videoId) {
    return {
      type: "youtube",
      url,
      title: ref.title || "YouTube (unparseable URL)",
      content: "",
      error: `Could not extract YouTube video id from URL: ${url}`,
      fetchedAt,
    };
  }
  try {
    const { info, transcript } = await getVideoWithTranscript(videoId);
    let text = transcript?.text ?? "";
    let source = text ? "caption" : "none";
    if (!text) {
      const asr = await transcribeYoutubeVideo(videoId);
      if (asr) {
        text = asr.text;
        source = "asr";
      }
    }
    if (!text) {
      return {
        type: "youtube",
        url,
        title: ref.title || info.title || `YouTube · ${videoId}`,
        content: "",
        error: `No transcript available for ${videoId} (no captions, ASR failed)`,
        fetchedAt,
      };
    }
    return {
      type: "youtube",
      url,
      title: ref.title || info.title || `YouTube · ${videoId}`,
      content: text,
      source,
      fetchedAt,
    };
  } catch (err) {
    return {
      type: "youtube",
      url,
      title: ref.title || `YouTube · ${videoId}`,
      content: "",
      error: (err as Error).message.slice(0, 200),
      fetchedAt,
    };
  }
}

async function fetchXhsReference(ref: ReferenceInput): Promise<FetchedReference> {
  const url = ref.url ?? "";
  const noteId = extractXhsNoteId(url);
  const fetchedAt = new Date().toISOString();
  if (!noteId) {
    return {
      type: "xhs",
      url,
      title: ref.title || "XHS (unparseable URL)",
      content: "",
      error: `Could not extract XHS note id from URL: ${url}`,
      fetchedAt,
    };
  }
  try {
    const note = await getXhsNoteDetail(noteId);
    if (!note) {
      return {
        type: "xhs",
        url,
        title: ref.title || `XHS · ${noteId}`,
        content: "",
        error: `XHS note ${noteId} not found`,
        fetchedAt,
      };
    }
    const combined = [note.title, note.desc]
      .filter((s) => s.trim().length > 0)
      .join("\n\n")
      .trim();
    return {
      type: "xhs",
      url,
      title: ref.title || note.title || `XHS · ${noteId}`,
      content: combined,
      source: combined ? "text" : "none",
      fetchedAt,
    };
  } catch (err) {
    return {
      type: "xhs",
      url,
      title: ref.title || `XHS · ${noteId}`,
      content: "",
      error: (err as Error).message.slice(0, 200),
      fetchedAt,
    };
  }
}

export async function fetchReference(ref: ReferenceInput): Promise<FetchedReference> {
  const fetchedAt = new Date().toISOString();
  if (ref.kind === "text") {
    return {
      type: "text",
      title: ref.title || "Pasted reference",
      content: ref.text ?? "",
      fetchedAt,
    };
  }
  if (ref.kind === "youtube") return fetchYoutubeReference(ref);
  if (ref.kind === "xhs") return fetchXhsReference(ref);
  return {
    type: ref.kind,
    url: ref.url,
    title: ref.title || "Unknown reference",
    content: "",
    error: `Unknown reference kind: ${ref.kind}`,
    fetchedAt,
  };
}

export async function fetchReferences(refs: ReferenceInput[]): Promise<FetchedReference[]> {
  const out: FetchedReference[] = [];
  for (const ref of refs) {
    out.push(await fetchReference(ref));
  }
  return out;
}

export type { CaptionTrack };
