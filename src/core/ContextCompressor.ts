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
    isSkillContentProtected = false,
  ): Promise<Message[]> {
    if (!messages || messages.length === 0) return []

    const contextWindow = modelContextWindow ?? this.defaultContextWindow
    const threshold = Math.floor(contextWindow * this.thresholdRatio)
    if (this.estimateTokens(messages) <= threshold) return messages

    const { system, tail, body } = this.splitMessages(messages)
    if (body.length === 0) return messages

    if (isSkillContentProtected) {
      return this.compressProtected(system, body, tail)
    }

    const summary = this.summarize(body)
    return [...system, summaryMessage(summary), ...tail]
  }

  // ── message splitting ────────────────────────────────────────────

  private splitMessages(messages: Message[]) {
    const systemIndex = messages.findIndex((m) => m.role === "system")
    const system: Message[] = systemIndex >= 0 ? [messages[systemIndex]] : []
    const bodyStart = systemIndex >= 0 ? systemIndex + 1 : 0

    let bodyEnd = messages.length - 3
    while (bodyEnd > bodyStart && messages[bodyEnd]?.role === "tool") bodyEnd--

    return {
      system,
      body: messages.slice(bodyStart, bodyEnd),
      tail: messages.slice(bodyEnd),
    }
  }

  // ── protected path ───────────────────────────────────────────────

  private async compressProtected(
    system: Message[],
    body: Message[],
    tail: Message[],
  ): Promise<Message[]> {
    const { protectedMsgs, compressible } = this.partitionProtected(body)
    if (compressible.length === 0) {
      return this.ensureValidToolSequence([...system, ...protectedMsgs, ...tail])
    }
    const summary = this.summarize(compressible)
    return this.ensureValidToolSequence([
      ...system,
      ...protectedMsgs,
      summaryMessage(summary),
      ...tail,
    ])
  }

  private partitionProtected(body: Message[]) {
    const protectedMsgs: Message[] = []
    const compressible: Message[] = []
    let i = 0
    while (i < body.length) {
      const { turn, end, isProtected } = this.classifyTurn(body, i)
      if (isProtected) protectedMsgs.push(...turn)
      else compressible.push(...turn)
      i = end
    }
    return { protectedMsgs, compressible }
  }

  private classifyTurn(body: Message[], start: number) {
    const m = body[start]
    if (m.role !== "assistant" || !m.toolCalls || m.toolCalls.length === 0) {
      return { turn: [m], end: start + 1, isProtected: false }
    }
    let j = start + 1
    while (j < body.length && body[j].role === "tool") j++
    const turn = body.slice(start, j)
    const isProtected = turn.some(
      (t) => t.role === "tool" && typeof t.content === "string" && t.content.startsWith("[SKILL_ACTIVATION]"),
    )
    return { turn, end: j, isProtected }
  }

  // ── tool-sequence validation ─────────────────────────────────────

  private ensureValidToolSequence(msgs: Message[]): Message[] {
    const result: Message[] = []
    for (const m of msgs) {
      if (m.role === "tool") {
        if (!this.hasMatchingAssistant(result, m.tool_call_id)) continue
      }
      result.push(m)
    }
    return result
  }

  private hasMatchingAssistant(result: Message[], toolCallId?: string): boolean {
    for (let i = result.length - 1; i >= 0; i--) {
      const prev = result[i]
      if (prev.role === "assistant") {
        return (prev.toolCalls ?? []).some((tc) => tc.id === toolCallId)
      }
      if (prev.role === "user" || prev.role === "system") break
    }
    return false
  }

  // ── summarisation ────────────────────────────────────────────────

  private summarize(segment: Message[]): string {
    const totalTurns = segment.length
    const assistantMsgs = segment.filter((m) => m.role === "assistant").length
    const toolCalls = segment.filter((m) => m.role === "tool").length
    const userMsgs = segment.filter((m) => m.role === "user").length

    const parts: string[] = [`${totalTurns} conversation turns`]
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

function summaryMessage(summary: string): Message {
  return { role: "assistant", content: `Summary of prior context: ${summary}` }
}
