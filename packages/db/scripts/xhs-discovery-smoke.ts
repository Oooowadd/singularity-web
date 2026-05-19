// Phase 0 — XHS endpoint discovery against real URLs.
// Output: raw JSON dumps so we can design the xhs.ts client around the actual
// field shapes rather than guessing from RedFinch / archive docs.

import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url) });

const BASE = "https://api.tikhub.io";

async function call(
  endpoint: string,
  params: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const k = process.env.TIKHUB_API_KEY;
  if (!k) throw new Error("TIKHUB_API_KEY not set");
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${endpoint}?${qs}`;
  console.log(`\n→ GET ${endpoint}  ${JSON.stringify(params)}`);
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${k}`,
      accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`  status=${res.status}  elapsed=${Date.now() - t0}ms`);
  return { status: res.status, body };
}

function showJson(label: string, obj: unknown, maxLen = 4000) {
  const s = JSON.stringify(obj, null, 2);
  console.log(`\n--- ${label} ---`);
  if (s.length <= maxLen) {
    console.log(s);
  } else {
    console.log(s.slice(0, maxLen));
    console.log(`\n[truncated; full body was ${s.length} chars]`);
  }
}

function showKeys(label: string, obj: unknown) {
  if (obj && typeof obj === "object") {
    console.log(`  ${label} keys: ${Object.keys(obj as object).join(", ")}`);
  } else {
    console.log(`  ${label}: ${typeof obj}`);
  }
}

const USERS = {
  redhead_witch: "6166b66a0000000002027a1d",
  exploration: "672a8c0a000000001d02d088",
};

const NOTES = {
  video: {
    id: "69d4f1e60000000021010db4",
    xsec_token: "ABHwAUKKTP-15YaVMFvDjANuRAcalo3kV4lrxeJc3KvFs=",
  },
  image: {
    id: "6a0288a20000000038035cae",
    xsec_token: "ABzNOY2LoXXGgjNewauDBQoImpRie0a0KUslC0Y1e8IfY=",
  },
};

async function main() {
  // ──────────────────────────────────────────────────────────────
  console.log("\n══════════════ STAGE 1 · get_user_info ══════════════");
  // ──────────────────────────────────────────────────────────────
  for (const [name, userId] of Object.entries(USERS)) {
    const r = await call("/api/v1/xiaohongshu/web/get_user_info", { user_id: userId });
    showJson(`${name} (user_id=${userId})`, r.body, 3000);
  }

  // ──────────────────────────────────────────────────────────────
  console.log("\n\n══════════════ STAGE 2 · get_user_notes_v2 ══════════════");
  // ──────────────────────────────────────────────────────────────
  const lists: Record<string, unknown> = {};
  for (const [name, userId] of Object.entries(USERS)) {
    const r = await call("/api/v1/xiaohongshu/web/get_user_notes_v2", { user_id: userId });
    lists[name] = r.body;
    if (r.body && typeof r.body === "object") {
      const data = (r.body as { data?: unknown }).data;
      if (data && typeof data === "object") {
        const notes = (data as { notes?: unknown[] }).notes ?? [];
        console.log(`  → ${name}: ${notes.length} notes`);
        notes.slice(0, 3).forEach((n: unknown, i) => {
          if (n && typeof n === "object") {
            const note = n as Record<string, unknown>;
            console.log(
              `    [${i}] type=${note.type ?? "?"}  id=${note.id ?? note.note_id ?? "?"}  title="${String(note.title ?? note.display_title ?? "").slice(0, 30)}"`,
            );
          }
        });
        showKeys("first note", notes[0]);
      } else {
        showJson(`${name} unexpected shape`, r.body, 1000);
      }
    }
  }

  // Dump first full note for exploration account so we see ALL fields:
  console.log("\n\n══════ STAGE 2b · first note FULL JSON (exploration account) ══════");
  const explNotes =
    (lists.exploration as { data?: { notes?: unknown[] } } | undefined)?.data?.notes ?? [];
  if (explNotes[0]) {
    showJson("first note full", explNotes[0], 5000);
  }

  // ──────────────────────────────────────────────────────────────
  console.log("\n\n══════════════ STAGE 3 · get_note_info_v4 (web) ══════════════");
  // ──────────────────────────────────────────────────────────────
  for (const [name, note] of Object.entries(NOTES)) {
    console.log(`\n┄┄┄ ${name} note ┄┄┄`);
    const r = await call("/api/v1/xiaohongshu/web/get_note_info_v4", {
      note_id: note.id,
    });
    showJson(`v4 with note_id only`, r.body, 4000);

    // Also try with xsec_token attached:
    const r2 = await call("/api/v1/xiaohongshu/web/get_note_info_v4", {
      note_id: note.id,
      xsec_token: note.xsec_token,
    });
    if (JSON.stringify(r.body) !== JSON.stringify(r2.body)) {
      showJson(`v4 with xsec_token (differs from above)`, r2.body, 4000);
    } else {
      console.log(`  v4 with xsec_token: same response as without`);
    }
  }

  // ──────────────────────────────────────────────────────────────
  console.log("\n\n══════════════ STAGE 4 · web_v3/fetch_note_detail (alternative) ══════════════");
  // ──────────────────────────────────────────────────────────────
  for (const [name, note] of Object.entries(NOTES)) {
    console.log(`\n┄┄┄ ${name} note ┄┄┄`);
    const r = await call("/api/v1/xiaohongshu/web_v3/fetch_note_detail", {
      note_id: note.id,
    });
    showJson(`web_v3 with note_id only`, r.body, 4000);
  }

  // ──────────────────────────────────────────────────────────────
  console.log("\n\n══════════════ STAGE 5 · sample real notes from exploration account ══════════════");
  // ──────────────────────────────────────────────────────────────
  // Find one video and one image note from the exploration account list,
  // fetch full detail for each, so we see the difference in shape.
  const explList = explNotes as Array<Record<string, unknown>>;
  const firstVideo = explList.find((n) => n.type === "video");
  const firstImage = explList.find((n) => n.type !== "video");
  for (const [label, n] of [["video", firstVideo], ["image", firstImage]] as const) {
    if (!n) {
      console.log(`\n  no ${label} note found in exploration account list`);
      continue;
    }
    const noteId = String(n.id ?? n.note_id ?? "");
    if (!noteId) continue;
    console.log(`\n┄┄┄ sample ${label} note (id=${noteId}) ┄┄┄`);
    const r = await call("/api/v1/xiaohongshu/web/get_note_info_v4", {
      note_id: noteId,
    });
    showJson(`detail`, r.body, 6000);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
