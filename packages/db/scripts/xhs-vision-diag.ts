import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url) });
import { getXhsNoteDetail } from "@singularity/integrations/clients/xhs";
import { analyzeImageStack, analyzeThumbnail } from "@singularity/integrations/clients/vision";

const log = (m: string) => console.log(m);
const logger = { warn: (m: string) => console.log("  ! " + m), info: log };

async function main() {
  console.log("\n=== XHS image note (18 images, J&J) ===");
  const img = await getXhsNoteDetail("6a0288a20000000038035cae");
  console.log("images normalized URLs:");
  img!.images.slice(0, 3).forEach((i, n) =>
    console.log(`  [${n}] ${i.url.slice(0, 100)}`),
  );

  console.log("\n→ single thumbnail vision");
  const s = await analyzeThumbnail(img!.images[0]!.url, "zh", logger);
  console.log("  result:", s ? `desc="${s.description.slice(0, 100)}…"` : "(null)");

  console.log("\n→ stack vision (all 18)");
  const urls = img!.images.map((i) => i.originalUrl || i.url);
  const stack = await analyzeImageStack(urls, "zh", logger);
  console.log("  result:", stack ? `desc="${stack.description.slice(0, 150)}…"` : "(null)");

  console.log("\n=== XHS video note thumbnail ===");
  const vid = await getXhsNoteDetail("69d4f1e60000000021010db4");
  console.log("thumbnailUrl:", vid!.thumbnailUrl);
  const vs = await analyzeThumbnail(vid!.thumbnailUrl!, "zh", logger);
  console.log("  video thumb vision:", vs ? `desc="${vs.description.slice(0, 100)}…"` : "(null)");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
