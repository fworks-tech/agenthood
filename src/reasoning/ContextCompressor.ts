import type { Message } from '../llm/types.js'
import type { ILLMProvider } from '../llm/ILLMProvider.js'

export interface ContextCompressorConfig {
  maxTokens: number
  tokenRatio: number
  preserveLastMessages: number
}

const DEFAULT_CONFIG: ContextCompressorConfig = {
  maxTokens: 64000,
  tokenRatio: 4,
  preserveLastMessages: 6,
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function countMessagesTokens(messages: Message[]): number {
  let total = 0
  for (const m of messages) {
    total += estimateTokens(m.content)
    if (m.toolCalls) {
      for (const tc of m.toolCalls) {
        total += estimateTokens(tc.name)
        total += estimateTokens(JSON.stringify(tc.args))
      }
    }
  }
  return total
}

export class ContextCompressor {
  private config: ContextCompressorConfig

  constructor(config?: Partial<ContextCompressorConfig>, private llm?: ILLMProvider) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  compress(messages: Message[]): Message[] {
    const totalTokens = countMessagesTokens(messages)
    if (totalTokens <= this.config.maxTokens) return messages

    const systemIndex = messages.findIndex(m => m.role === 'system')
    const system = systemIndex >= 0 ? [messages[systemIndex]] : []
    const preservedStart = Math.max(systemIndex + 1, messages.length - this.config.preserveLastMessages)

    const preserve = messages.slice(preservedStart)
    const compressible = messages.slice(systemIndex + 1, preservedStart)

    if (compressible.length === 0) return messages

    const summary = this.summarize(compressible)
    return [...system, { role: 'system', content: messages[0].content + '\n\n[Previous conversation summary: ' + summary + ']' }, ...preserve]
  }

  private summarize(segment: Message[]): string {
    const total = segment.length
    const assistantMsgs = segment.filter(m => m.role === 'assistant').length
    const toolCalls = segment.filter(m => m.role === 'tool').length

    const parts: string[] = []
    parts.push(`${total} conversation turns`)
    if (assistantMsgs > 0) parts.push(`${assistantMsgs} assistant responses`)
    if (toolCalls > 0) parts.push(`${toolCalls} tool uses`)

    return parts.join(', ') + '.'
  }
}
