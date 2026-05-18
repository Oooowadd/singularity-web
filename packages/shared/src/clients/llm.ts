import { createDeepSeek } from "@ai-sdk/deepseek";

// Lazy-init: Trigger.dev scans modules at deploy time; defer env throw to first call.
let _deepseek: ReturnType<typeof createDeepSeek> | null = null;

function getDeepseek() {
  if (!_deepseek) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY not set in env");
    }
    _deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
  }
  return _deepseek;
}

export type LlmTier = "flash" | "pro";

export function llm(tier: LlmTier = "flash") {
  return getDeepseek()(tier === "pro" ? "deepseek-v4-pro" : "deepseek-v4-flash");
}
