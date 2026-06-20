import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { Message } from "../llm/types.ts"

export class ContextCompressor {
  private defaultContextWindow: number

  constructor(
    private llm: ILLMProvider,
    private thresholdRatio = 0.8,
    defaultContextWindow = 8192,
  ) {
    this.defaultContextWindow = defaultContextWindow
  }

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

  private estimateTokens(messages: Message[]): number {
    let total = 0
    for (const m of messages) {
      total += Math.ceil(m.content.length / 4)
    }
    return total
  }
}
