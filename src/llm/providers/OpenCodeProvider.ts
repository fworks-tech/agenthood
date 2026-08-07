import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
} from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { MissingApiKeyError } from "../validateApiKeys.ts"
import { validateMessages } from "./validation.ts"
import { createChatCompletionsHandler } from "./chat-completions.ts"
import type { ChatCompletionsHandler, ChatCompletionsClient } from "./chat-completions.ts"
import { DEFAULT_CONTEXT_WINDOW, OPENCODE_DEFAULT_MODEL } from "./constants.ts"

function toOpenAIMessages(
  messages: LLMRequest["messages"],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      }))
    }

    if (msg.tool_call_id) {
      base.tool_call_id = msg.tool_call_id
    }

    if (msg.name) {
      base.name = msg.name
    }

    return base as unknown as OpenAI.Chat.ChatCompletionMessageParam
  })
}

export class OpenCodeProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;
  private chat: ChatCompletionsHandler;

  constructor(config: LLMConfig) {
    const apiKey = config.apiKey ?? process.env.OPENCODE_API_KEY
    if (!apiKey) {
      throw new MissingApiKeyError("opencode", "OPENCODE_API_KEY", "https://opencode.ai")
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl ?? "https://opencode.ai/zen/v1",
    });
    this.model = config.model ?? OPENCODE_DEFAULT_MODEL;
    this.chat = createChatCompletionsHandler(
      this.client.chat.completions as unknown as ChatCompletionsClient,
      "OpenCode",
      () => this.model,
    );
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    validateMessages(request.messages);

    return this.chat.complete({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      tools: request.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as Record<string, unknown>,
        },
      })) as OpenAI.Chat.ChatCompletionTool[] | undefined,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.top_p,
    })
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    validateMessages(request.messages);

    return this.chat.stream({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    })
  }

  getContextWindow(): number {
    return DEFAULT_CONTEXT_WINDOW
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "OpenCode")
  }
}
