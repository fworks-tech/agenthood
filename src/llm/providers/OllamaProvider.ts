import type { ILLMProvider } from '../ILLMProvider.js'
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from '../types.js'

interface OllamaChatResponse {
  message: { content: string; role: string }
  done: boolean
  prompt_eval_count?: number
  eval_count?: number
}

interface OllamaEmbedResponse {
  embedding: number[]
}

export class OllamaProvider implements ILLMProvider {
  private baseUrl: string
  private model: string

  constructor(config: LLMConfig) {
    this.baseUrl = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
    this.model = config.model ?? 'llama3.2'
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          tools: request.tools?.map(t => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            },
          })),
          options: {
            temperature: request.temperature,
            top_p: request.top_p,
          },
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Ollama API error (${response.status}): ${body}`)
      }

      const data = (await response.json()) as OllamaChatResponse

      return {
        content: data.message.content,
        usage: {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        model: this.model,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('fetch') || msg.includes('connect')) {
        throw new Error(
          `OllamaProvider: Cannot connect to ${this.baseUrl}. Ensure Ollama is running (ollama serve).`
        )
      }
      throw new Error(`OllamaProvider.complete() failed: ${msg}`)
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        options: {
          temperature: request.temperature,
          top_p: request.top_p,
        },
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Ollama API error (${response.status}): ${body}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('OllamaProvider: No response body for streaming')

    const decoder = new TextDecoder()

    async function* generate(): AsyncGenerator<LLMChunk> {
      let buffer = ''
      while (true) {
        const { done, value } = await reader!.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line) as OllamaChatResponse
            if (chunk.message?.content) {
              yield { delta: chunk.message.content, done: false }
            }
            if (chunk.done) {
              yield { delta: '', done: true }
              return
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }
      yield { delta: '', done: true }
    }

    return generate()
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Ollama embed error (${response.status}): ${body}`)
      }

      const data = (await response.json()) as OllamaEmbedResponse
      return data.embedding
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`OllamaProvider.embed() failed: ${msg}`)
    }
  }
}
