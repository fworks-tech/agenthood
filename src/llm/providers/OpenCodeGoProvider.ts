import { OpenCodeProvider } from "./OpenCodeProvider.ts"
import type { LLMConfig } from "../types.ts"

/**
 * OpenCode Go — the low-cost subscription tier of OpenCode Zen.
 * Same base as OpenCode, but the Go proxy rejects sampling extras
 * (top_p, frequency_penalty, presence_penalty, stop) with a 400
 * "Upstream request failed", so the body builder is swapped.
 */
export class OpenCodeGoProvider extends OpenCodeProvider {
  constructor(config: LLMConfig) {
    super({ ...config, baseUrl: config.baseUrl ?? "https://opencode.ai/zen/go/v1" }, { goTier: true })
  }
}

