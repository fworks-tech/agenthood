export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface Message {
  role: MessageRole
  content: string
  toolCalls?: ToolCall[]
  name?: string
}

export interface ToolCall {
  id: string
  name: string
  args: unknown
}

export interface ToolSchema {
  name: string
  description: string
  inputSchema: JSONSchema
}

export interface JSONSchema {
  type: string
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  [key: string]: unknown
}

export interface JSONSchemaProperty {
  type: string
  description?: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cacheCreationInputTokens?: number
  cacheReadInputTokens?: number
}

export interface LLMRequest {
  messages: Message[]
  tools?: ToolSchema[]
  temperature?: number
  maxTokens?: number
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
  stop?: string[]
  contextWindow?: number
}

export interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  usage: TokenUsage
  model: string
}

export interface LLMChunk {
  delta: string
  done: boolean
}

export interface LLMConfig {
  provider?: string
  model?: string
  baseUrl?: string
  apiKey?: string
}
