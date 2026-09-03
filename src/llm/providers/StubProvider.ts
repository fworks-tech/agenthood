import type { ILLMProvider } from '../ILLMProvider.ts'
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig, ToolCall } from '../types.ts'

export const STUB_PROVIDER_ENV = 'AGENTHOOD_STUB_PROVIDER'

export interface StubScriptStep {
  content?: string
  toolCalls?: ToolCall[]
}

/**
 * Scripted test-only provider for hermetic HITL spikes: replays queued
 * responses so a real MemberRunner + ReActLoop can park on ask_human
 * without network or API keys. Refuses to construct unless the env gate
 * is set, and stays out of ProviderName so no member can prefer it —
 * without the gate the router skips it and real fallbacks apply.
 */
export class StubProvider implements ILLMProvider {
  private static script: StubScriptStep[] = []
  private model: string

  static enqueueScript(steps: StubScriptStep[]): void {
    StubProvider.script.push(...steps)
  }

  static resetScript(): void {
    StubProvider.script = []
  }

  constructor(config: LLMConfig) {
    if (process.env[STUB_PROVIDER_ENV] !== '1') {
      throw new Error(`StubProvider is test-only: set ${STUB_PROVIDER_ENV}=1 to construct it`)
    }
    this.model = config.model ?? 'stub'
  }

  async complete(_request: LLMRequest): Promise<LLMResponse> {
    const step = StubProvider.script.shift() ?? {}
    return {
      content: step.content ?? '',
      toolCalls: step.toolCalls,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: this.model,
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const res = await this.complete(request)

    async function* generate(): AsyncGenerator<LLMChunk> {
      if (res.content) yield { delta: res.content, done: false }
      yield { delta: '', done: true }
    }

    return generate()
  }

  getContextWindow(): number {
    return 8192
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(_text: string): Promise<number[]> {
    return new Array(8).fill(0)
  }
}
