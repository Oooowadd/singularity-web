import { createDeepSeek } from "@ai-sdk/deepseek";

/**
 * Two-tier DeepSeek model strategy:
 *
 *   flash — V4 Flash. Cheap/fast: classification, gating, short critique.
 *   pro   — V4 Pro with reasoning. Deep work: analyzer, SOP gen, long-form.
 *
 * Both models are reasoning-enabled by default; response carries
 * `reasoning_content` alongside the answer.
 *
 * Client is lazy-initialized so module import does not require the env
 * variable to be set at bundle time (Trigger.dev evaluates module-level
 * code during deployment scan; we only want the throw to happen when
 * the model is actually called).
 */
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
