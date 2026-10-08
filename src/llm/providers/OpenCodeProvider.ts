import OpenAI from "openai";
import type { LLMConfig, LLMRequest, LLMResponse, LLMChunk, Message, ToolSchema } from "../types.ts"
import { ChatCompletionsProvider } from "./chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "./chat-completions-provider.ts"
import type { ParamConverters } from "./openai-params.ts"
import { buildGoCompleteParams } from "./openai-params.ts"
import { DEFAULT_CONTEXT_WINDOW, OPENCODE_DEFAULT_MODEL } from "./constants.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { zenProtocolForModel } from "./zenEndpoints.ts"
import type { ZenProtocol } from "./zenEndpoints.ts"
import { randomUUID } from "node:crypto"

function toOpenAIMessages(messages: Message[]): unknown {
  return messages.map((msg) => {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      }))
    }
    if (msg.tool_call_id) base.tool_call_id = msg.tool_call_id
    if (msg.name) base.name = msg.name
    return base
  })
}

function toOpenAITools(tools: ToolSchema[]): unknown {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    },
  }))
}

const opencodeConverters: ParamConverters = {
  convertMessages: toOpenAIMessages,
  convertTools: toOpenAITools,
}

// Anthropic `/v1/messages` request shape. Zen serves Claude and qwen3.8-flash on
// this endpoint with `Authorization: Bearer`, so the SDK needs `authToken`, not
// `apiKey` (which would send x-api-key).
function toAnthropicBody(req: LLMRequest, model: string) {
  let system: string | undefined
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = []
  for (const m of req.messages) {
    if (m.role === 'system') { system = system ? `${system}\n${m.content}` : m.content; continue }
    if (m.role === 'tool') {
      // Prefer tool_call_id (the Anthropic tool_use block ID) over name.
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id ?? m.name ?? '', content: m.content }] })
      continue
    }
    const blocks: unknown[] = []
    if (m.content) blocks.push({ type: 'text', text: m.content })
    for (const tc of m.toolCalls ?? []) blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
    messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: blocks })
  }
  return {
    model,
    ...(system ? { system } : {}),
    messages,
    max_tokens: req.maxTokens ?? 4096,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.top_p !== undefined ? { top_p: req.top_p } : {}),
    ...(req.stop?.length ? { stop_sequences: req.stop } : {}),
    ...(req.tools?.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })) } : {}),
  }
}

type AnthropicResponseBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown }

function fromAnthropic(data: { content?: AnthropicResponseBlock[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string }, fallbackModel: string): LLMResponse {
  const blocks = data.content ?? []
  const content = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')
  const toolCalls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id!, name: b.name!, args: b.input as Record<string, unknown> }))
  const promptTokens = data.usage?.input_tokens ?? 0
  const completionTokens = data.usage?.output_tokens ?? 0
  return {
    content,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    model: data.model ?? fallbackModel,
  }
}

export class OpenCodeProvider extends ChatCompletionsProvider {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly sessionId: string

  constructor(config: LLMConfig, runtimeOptions: { goTier?: boolean } = {}) {
    const isInsideClient = !!process.env.OPENCODE_CLIENT_SESSION
    const apiKey = config.apiKey ?? process.env.OPENCODE_API_KEY ?? ""
    const baseUrl = config.baseUrl ?? "https://opencode.ai/zen/v1"
    const sessionId = process.env.OPENCODE_CLIENT_SESSION || randomUUID()

    const options: ChatCompletionsProviderOptions = {
      providerName: "OpenCode",
      apiKeyEnv: "OPENCODE_API_KEY",
      requireApiKey: !isInsideClient,
      signupUrl: "https://opencode.ai",
      baseUrlDefault: baseUrl,
      defaultModel: OPENCODE_DEFAULT_MODEL,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      converters: opencodeConverters,
      paramsBuilder: runtimeOptions.goTier ? buildGoCompleteParams : undefined,
      createClient: (key, url) =>
        new OpenAI({
          apiKey: isInsideClient ? undefined : key,
          baseURL: url,
          defaultHeaders: { "x-opencode-session": sessionId },
        }),
    }
    super(config, options)
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.sessionId = sessionId
  }

  private protocol(): ZenProtocol {
    return zenProtocolForModel(this._model)
  }

  // The OpenAI SDK only speaks chat-completions; messages/responses/systemone
  // models need their own endpoint. Rejected with a pointer, not a silent 400.
  // When inside the OpenCode client session (no standalone API key), we use a
  // fetch-based transport with the session header instead of the Anthropic SDK,
  // which requires either apiKey or authToken.
  private async anthropicClient(): Promise<import("@anthropic-ai/sdk").default> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    return new Anthropic({
      authToken: this.apiKey || undefined,
      baseURL: this.baseUrl,
      defaultHeaders: { "x-opencode-session": this.sessionId },
    })
  }

  private async messagesRequest(body: Record<string, unknown>, stream = false): Promise<Response> {
    const url = `${this.baseUrl}/v1/messages`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
        'x-opencode-session': this.sessionId,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...body, stream }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Zen messages request failed: ${res.status} ${text}`)
    }
    return res
  }

  getContextWindow(): number {
    return this.protocol() === 'messages' ? 200000 : super.getContextWindow()
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const protocol = this.protocol()
    if (protocol === 'chat') return super.complete(request)
    if (protocol === 'messages') {
      const body = toAnthropicBody(request, this._model)
      // Use fetch for client-session (no apiKey), SDK otherwise
      if (!this.apiKey) {
        const res = await this.messagesRequest(body)
        return fromAnthropic(await res.json() as { content?: AnthropicResponseBlock[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string }, this._model)
      }
      const client = await this.anthropicClient()
      const res = (await client.messages.create(body as never)) as {
        content?: AnthropicResponseBlock[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string
      }
      return fromAnthropic(res, this._model)
    }
    if (protocol === 'systemone') {
      throw new UnsupportedOperationError(`Jev "${this._model}" is a decision model (no prose); call decideWithJev() from llm/systemone.ts`, 'OpenCode')
    }
    throw new UnsupportedOperationError(`Zen "${this._model}" is served on /v1/responses, which this provider does not implement yet`, 'OpenCode')
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const protocol = this.protocol()
    if (protocol === 'chat') return super.stream(request)
    if (protocol === 'messages') {
      const body = toAnthropicBody(request, this._model)
      // Use fetch for client-session (no apiKey), SDK otherwise
      if (!this.apiKey) {
        const res = await this.messagesRequest(body, true)
        async function* generate(): AsyncGenerator<LLMChunk> {
          const reader = res.body?.getReader()
          if (!reader) { yield { delta: '', done: true }; return }
          const decoder = new TextDecoder()
          let buffer = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim()
                if (data === '[DONE]') { yield { delta: '', done: true }; return }
                try {
                  const event = JSON.parse(data)
                  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
                    yield { delta: event.delta.text, done: false }
                  }
                } catch { /* ignore malformed SSE lines */ }
              }
            }
          }
          yield { delta: '', done: true }
        }
        return generate()
      }
      const client = await this.anthropicClient()
      const stream = await client.messages.create({ ...body, stream: true } as never) as unknown as AsyncIterable<{
        type: string; delta?: { type?: string; text?: string }
      }>
      async function* generate(): AsyncGenerator<LLMChunk> {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
            yield { delta: event.delta.text, done: false }
          }
        }
        yield { delta: '', done: true }
      }
      return generate()
    }
    if (protocol === 'systemone') {
      throw new UnsupportedOperationError(`Jev "${this._model}" is a decision model (no prose); call decideWithJev() from llm/systemone.ts`, 'OpenCode')
    }
    throw new UnsupportedOperationError(`Zen "${this._model}" is served on /v1/responses, which this provider does not implement yet`, 'OpenCode')
  }
}
