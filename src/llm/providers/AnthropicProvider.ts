import Anthropic from '@anthropic-ai/sdk'
import type { ILLMProvider } from '../ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig, ToolCall, ToolSchema, Message } from '../types.js'
import { UnsupportedOperationError } from '../errors.js'

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

function convertMessages(messages: Message[]): { system?: string; messages: { role: 'user' | 'assistant'; content: AnthropicContentBlock[] }[] } {
  let system: string | undefined
  const converted: { role: 'user' | 'assistant'; content: AnthropicContentBlock[] }[] = []

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content
      continue
    }
    if (msg.role === 'tool') {
      converted.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.name ?? '',
          content: msg.content,
        }],
      })
      continue
    }

    const blocks: AnthropicContentBlock[] = []
    if (msg.content) {
      blocks.push({ type: 'text', text: msg.content })
    }
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.args,
        })
      }
    }

    converted.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: blocks,
    })
  }

  return { system, messages: converted }
}

function convertTools(tools?: ToolSchema[]): Anthropic.Messages.Tool[] | undefined {
  if (!tools || tools.length === 0) return undefined
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Messages.Tool.InputSchema,
  }))
}

export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic
  private model: string

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    })
    this.model = config.model ?? 'claude-sonnet-4-20250514'
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const { system, messages } = convertMessages(request.messages)
      const tools = convertTools(request.tools)

      const response = await this.client.messages.create({
        model: this.model,
        system,
        messages,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: request.stop,
        tools,
      })

      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
      )
      const content = textBlocks.map(b => b.text).join('')

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
      )

      const toolCalls: ToolCall[] | undefined = toolUseBlocks.length > 0
        ? toolUseBlocks.map(b => ({
            id: b.id,
            name: b.name,
            args: b.input as Record<string, unknown>,
          }))
        : undefined

      return {
        content,
        toolCalls,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`AnthropicProvider.complete() failed: ${msg}`)
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const { system, messages } = convertMessages(request.messages)
    const tools = convertTools(request.tools)

    const stream = await this.client.messages.create({
      model: this.model,
      system,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
      top_p: request.top_p,
      stream: true,
      tools,
    })

    async function* generate(): AsyncGenerator<LLMChunk> {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { delta: event.delta.text, done: false }
        }
      }
      yield { delta: '', done: true }
    }

    return generate()
  }

  getContextWindow(): number {
    return 200000
  }

  async embed(text: string): Promise<number[]> {
    void text
    throw new UnsupportedOperationError('embed', 'AnthropicProvider')
  }
}
