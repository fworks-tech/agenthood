import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { Message } from "../llm/types.ts"

/**
 * Compresses conversation context when approaching token limits.
 *
 * Estimates token usage via a heuristic (content.length / 4), then
 * summarises the middle block into a single assistant message when
 * the total exceeds a configurable threshold ratio of the context window.
 * The system prompt and last N messages are preserved verbatim.
 *
 * Used before LLM calls to prevent context overflow without losing
 * critical conversation boundaries.
 */
export class ContextCompressor {
  private defaultContextWindow: number

  /**
   * @param llm - Used to query provider‑specific context window sizes
   * @param thresholdRatio - Fraction of context window that triggers compression (default 0.8)
   * @param defaultContextWindow - Fallback window when the provider does not report one (default 8192)
   */
  constructor(
    private llm: ILLMProvider,
    private thresholdRatio = 0.8,
    defaultContextWindow = 8192,
  ) {
    this.defaultContextWindow = defaultContextWindow
  }

  /**
   * Compress messages if they exceed the context window threshold.
   * Preserves the system prompt verbatim and the last 3 messages.
   * The middle block is replaced by a heuristic summarisation.
   *
   * @param messages - The full conversation history
   * @param modelContextWindow - Optional per‑model context window override
   * @returns The original messages if under threshold, or a compressed list
   */
  async compress(
    messages: Message[],
    modelContextWindow?: number,
  ): Promise<Message[]> {
    if (!messages || messages.length === 0) return []

    const contextWindow =
      modelContextWindow ?? this.defaultContextWindow
    const threshold = Math.floor(contextWindow * this.thresholdRatio)
    const totalTokens = this.estimateTokens(messages)

    if (totalTokens <= threshold) return messages

    const systemIndex = messages.findIndex((m) => m.role === "system")
    const system: Message[] =
      systemIndex >= 0 ? [messages[systemIndex]] : []

    const preserveLast = 3
    const bodyStart = systemIndex >= 0 ? systemIndex + 1 : 0
    const bodyEnd = messages.length - preserveLast
    const body = messages.slice(bodyStart, bodyEnd)

    if (body.length === 0) return messages

    const preserve = messages.slice(bodyEnd)
    const summary = this.summarize(body)

    return [
      ...system,
      { role: "assistant", content: `Summary of prior context: ${summary}` },
      ...preserve,
    ]
  }

  /**
   * Build a human‑readable summary of a conversation segment.
   * Counts turns, user messages, assistant responses, and tool uses.
   */
  private summarize(segment: Message[]): string {
    const totalTurns = segment.length
    const assistantMsgs = segment.filter((m) => m.role === "assistant").length
    const toolCalls = segment.filter((m) => m.role === "tool").length
    const userMsgs = segment.filter((m) => m.role === "user").length

    const parts: string[] = []
    parts.push(`${totalTurns} conversation turns`)
    if (userMsgs > 0) parts.push(`${userMsgs} user messages`)
    if (assistantMsgs > 0) parts.push(`${assistantMsgs} assistant responses`)
    if (toolCalls > 0) parts.push(`${toolCalls} tool uses`)

    return parts.join(", ") + "."
  }

  /**
   * Rough token estimation via character count divided by 4.
   * Used only for threshold comparison — not billed or counted precisely.
   */
  private estimateTokens(messages: Message[]): number {
    let total = 0
    for (const m of messages) {
      total += Math.ceil(m.content.length / 4)
    }
    return total
  }
}
