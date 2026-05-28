// Probe TikHub XHS endpoints to inspect response shape (used during deprecation migrations).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const KEY = process.env.TIKHUB_API_KEY!;
const userId = process.argv[2] ?? "672a8c0a000000001d02d088";

async function probe(path: string, params: Record<string, string>) {
  const url = new URL(`https://api.tikhub.io${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  const j = await r.json();
  console.log(`\n=== ${path} (status=${r.status}) ===`);
  if (!r.ok) {
    console.log(JSON.stringify(j, null, 2).slice(0, 800));
    return;
  }
  console.log("top keys:", Object.keys(j));
  console.log("data keys:", j.data ? Object.keys(j.data).slice(0, 20) : "(no data)");
  console.log("data.data keys:", Object.keys(j?.data?.data ?? {}));
  if (j?.data?.data?.notes?.[0]) {
    console.log("FIRST NOTE FULL:", JSON.stringify(j.data.data.notes[0], null, 2));
  } else if (j?.data?.data?.basicInfo) {
    console.log("BASIC INFO FULL:", JSON.stringify(j.data.data.basicInfo, null, 2));
    console.log("INTERACTIONS:", JSON.stringify(j.data.data.interactions ?? "none"));
  }
}

const noteId = process.argv[3] ?? "68a8b5c8000000000c019013";
await probe("/api/v1/xiaohongshu/web/get_note_info_v4", { note_id: noteId });
await probe("/api/v1/xiaohongshu/app_v2/get_image_note_detail", { note_id: noteId });
await probe("/api/v1/xiaohongshu/app_v2/get_video_note_detail", { note_id: noteId });
