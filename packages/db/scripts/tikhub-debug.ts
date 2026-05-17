/**
 * Inspect actual response shape of get_channel_videos_v3 + get_channel_id_v2.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const TOKEN = process.env.TIKHUB_API_KEY!;

async function call(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.tikhub.io${endpoint}?${qs}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const json = await res.json();
  return json;
}

function inspect(name: string, json: unknown) {
  console.log(`\n=== ${name} ===`);
  const d = json as { code?: number; data?: unknown };
  console.log("code:", d.code);
  if (d.data && typeof d.data === "object") {
    const data = d.data as Record<string, unknown>;
    console.log("data keys:", Object.keys(data));
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) {
        console.log(`  data.${k}: array length=${v.length}`);
        if (v.length > 0 && typeof v[0] === "object") {
          console.log(`    [0] keys:`, Object.keys(v[0]));
        }
      } else if (v && typeof v === "object") {
        console.log(`  data.${k}: object keys=${Object.keys(v).join(",")}`);
      } else {
        console.log(`  data.${k}:`, String(v).slice(0, 100));
      }
    }
  }
}

async function main() {
  const idResp = await call("/api/v1/youtube/web/get_channel_id_v2", {
    channel_url: "https://www.youtube.com/@LinusTechTips",
  });
  inspect("get_channel_id_v2", idResp);

  const channelId = (idResp as { data?: { channel_id?: string } }).data?.channel_id;
  if (!channelId) {
    console.log("\nNo channel_id resolved — stopping");
    return;
  }
  console.log(`\nResolved channel_id = ${channelId}`);

  await new Promise((r) => setTimeout(r, 1500));

  const vidsResp = await call("/api/v1/youtube/web/get_channel_videos_v3", {
    channel_id: channelId,
  });
  inspect("get_channel_videos_v3 (raw YouTube structure)", vidsResp);

  await new Promise((r) => setTimeout(r, 1500));
  const v2Resp = await call("/api/v1/youtube/web/get_channel_videos_v2", {
    channel_id: channelId,
  });
  inspect("get_channel_videos_v2", v2Resp);

  await new Promise((r) => setTimeout(r, 1500));
  const v1Resp = await call("/api/v1/youtube/web/get_channel_videos", {
    channel_id: channelId,
  });
  inspect("get_channel_videos (v1)", v1Resp);

  await new Promise((r) => setTimeout(r, 1500));
  const wv2Resp = await call("/api/v1/youtube/web_v2/get_channel_videos", {
    channel_id: channelId,
  });
  inspect("web_v2/get_channel_videos", wv2Resp);

  await new Promise((r) => setTimeout(r, 1500));
  const infoResp = await call("/api/v1/youtube/web/get_video_info_v3", {
    video_id: "dQw4w9WgXcQ",
  });
  inspect("get_video_info_v3", infoResp);

  await new Promise((r) => setTimeout(r, 1500));
  const info2Resp = await call("/api/v1/youtube/web_v2/get_video_info", {
    video_id: "dQw4w9WgXcQ",
  });
  inspect("web_v2/get_video_info", info2Resp);
}

main().catch(console.error);
