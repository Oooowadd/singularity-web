/**
 * Smoke test for Poet pipeline services (bible / drift / scriptWriter / humanizer).
 * Run: pnpm --filter @singularity/db poet-services-smoke
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { generateChannelBible, tokenize, checkDrift, extractTopicLine } = await import(
  "@singularity/shared/services/poet/bible"
);
const { writeScriptShort } = await import("@singularity/shared/services/poet/script-writer");
const { humanizeChinese } = await import("@singularity/shared/services/poet/humanizer");

const FAKE_BIBLE = `TOPIC: 露营装备实测与避坑指南

## 1. CHANNEL DESCRIPTION — 露营装备实测与避坑指南
本频道专注于户外露营装备的真实测评……（略）

## 2. INFORMATION SOURCES
- 装备类小红书爆款笔记
- ……
`;

const FAKE_SOP = `# CONTENT_FORMULA
开头 5 秒强钩子：直接抛出冲突或数字。
# HOOK_TEMPLATES
- "我花了 X 块买了 Y，结果……"
- "别再被 X 骗了——真相是 Y"
`;

async function testDriftPureUnit() {
  console.log("═══ Test 1: drift heuristics (offline)");

  console.log("  1a tokenize ENG:", [...tokenize("Leica cameras and lenses")].slice(0, 6));
  console.log("  1b tokenize ZH:", [...tokenize("露营装备实测与避坑指南")].slice(0, 6));

  const noOverlap = checkDrift(
    "Leica cameras and film stocks",
    "AI tools for productivity",
    "AI ChatGPT LLM ChatGPT machine learning",
  );
  console.log("  1c no-overlap →", noOverlap?.reason, "(expect no_overlap)");

  const aiSub = checkDrift(
    "Italian regional home cooking",
    "Italian regional home cooking with a focus on Sicily",
    "talk about AI and LLM and ChatGPT here, plus another AI mention, and one more ChatGPT.",
  );
  console.log("  1d ai-markers →", aiSub?.reason, "(expect ai_markers)");

  const clean = checkDrift(
    "Leica cameras and photography",
    "Leica cameras and photography for collectors",
    "all about Leica cameras and film stocks — no AI mentions here at all",
  );
  console.log("  1e clean →", clean === null ? "null ✓" : clean.reason);

  console.log("  1f extract TOPIC: line:", extractTopicLine(FAKE_BIBLE));
}

async function testBibleGeneration() {
  console.log("\n═══ Test 2: full Bible generation (zh)");
  const t0 = Date.now();
  const bible = await generateChannelBible({
    ideaText:
      "我想做一个面向中国宝妈的小红书频道，主打 0-3 岁宝宝辅食制作。每期一道菜，强调时间成本与营养均衡。",
    channelDescription:
      "目标用户：北上广深 28-35 岁全职/兼职妈妈。痛点：每天 30 分钟内做完辅食，担心营养不够。",
    language: "zh",
  });
  console.log(`  Took ${((Date.now() - t0) / 1000).toFixed(1)}s, ${bible.content.length} chars`);
  console.log(`  Topic claimed: ${bible.topicClaimed}`);
  console.log(`  Drift: ${bible.driftWarning?.reason ?? "none ✓"}`);
  console.log(`  --- Content head ---`);
  console.log(bible.content.slice(0, 600));
}

async function testBibleDriftOnce() {
  console.log("\n═══ Test 3: Bible drift case — generic / abstract idea");
  const t0 = Date.now();
  const bible = await generateChannelBible({
    ideaText: "我想做一个频道分享内容创作的方法",
    channelDescription: "目标观众：内容创作者",
    language: "zh",
  });
  console.log(`  Took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  Topic claimed: ${bible.topicClaimed}`);
  console.log(`  Drift: ${bible.driftWarning?.reason ?? "none"}`);
  if (bible.driftWarning) {
    console.log(`  Message: ${bible.driftWarning.humanMessage}`);
    if (bible.driftWarning.markerHits != null) {
      console.log(`  Marker hits: ${bible.driftWarning.markerHits}`);
    }
  }
}

async function testShortScript() {
  console.log("\n═══ Test 4: short-form script (zh, 800 chars target)");
  const t0 = Date.now();
  const result = await writeScriptShort({
    idea: {
      storyAngle: "为什么 80% 的辅食营养表都在骗人？三个真相",
      factsAndData:
        "1. 美国儿科学会 2023 年建议铁补充自 6 个月起，但多数中文辅食模板从 4 个月开始铁强化；2. 100g 鸡肝铁含量 12mg vs 100g 牛肉只有 2.6mg；3. 维生素 C 让铁吸收率从 5% 提升到 25%。",
      whySimilar: "用反直觉数据 + 权威背书击穿宝妈圈的常见误区",
      viralTrigger: "强冲突标题 + 可执行清单",
      sourceTitle: "AAP Iron Supplementation 2023 Guidelines",
      sourceChannel: "American Academy of Pediatrics",
    },
    sopText: FAKE_SOP,
    bibleText: FAKE_BIBLE,
    language: "zh",
    targetWordCount: 800,
  });
  console.log(
    `  Took ${((Date.now() - t0) / 1000).toFixed(1)}s, wordCount=${result.wordCount}`,
  );
  console.log(`  --- Script head ---`);
  console.log(result.scriptText.slice(0, 700));

  // Quick checks
  const hasMarkers = ["[HOOK]", "[ITEM 1]", "[CLOSE]"].every((m) =>
    result.scriptText.includes(m),
  );
  console.log(`  Section markers present: ${hasMarkers ? "✓" : "✗"}`);
  const hasChinese = /[一-鿿]/.test(result.scriptText);
  console.log(`  Chinese chars present: ${hasChinese ? "✓" : "✗"}`);

  console.log("\n═══ Test 5: humanizer pass on the same script");
  const t1 = Date.now();
  const humanized = await humanizeChinese(result.scriptText);
  console.log(`  Took ${((Date.now() - t1) / 1000).toFixed(1)}s, ${humanized.length} chars`);
  const stillHasMarkers = ["[HOOK]", "[CLOSE]"].every((m) => humanized.includes(m));
  console.log(`  Markers preserved: ${stillHasMarkers ? "✓" : "✗"}`);
  console.log(`  --- Humanized head ---`);
  console.log(humanized.slice(0, 700));
}

async function main() {
  await testDriftPureUnit();
  await testBibleGeneration();
  await testBibleDriftOnce();
  await testShortScript();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
