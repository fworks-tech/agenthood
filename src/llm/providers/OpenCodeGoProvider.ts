import { OpenCodeProvider } from "./OpenCodeProvider.ts"
import type { LLMConfig } from "../types.ts"

export class OpenCodeGoProvider extends OpenCodeProvider {
  constructor(config: LLMConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? "https://opencode.ai/zen/go/v1",
    })
  }
}
