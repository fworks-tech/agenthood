import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
} from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"
import { validateMessages, parseToolCall } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"

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

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENCODE_API_KEY ?? "",
      baseURL: config.baseUrl ?? "https://opencode.ai/zen/v1",
    });
    this.model = config.model ?? "deepseek-v4-flash";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      validateMessages(request.messages);

      const openaiTools = request.tools?.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as Record<string, unknown>,
        },
      }))

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: toOpenAIMessages(request.messages),
        tools: openaiTools as OpenAI.Chat.ChatCompletionTool[] | undefined,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.top_p,
      });

      const choice = response.choices[0];
      const message = choice.message;
      const toolCalls = message.tool_calls?.map(
        (tc) => parseToolCall(tc, "OpenCode"),
      );

      return {
        content: message.content ?? "",
        toolCalls,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
      };
    } catch (err) {
      throw mapProviderError(err, "OpenCode", this.model);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    validateMessages(request.messages);

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    });

    return createStreamGenerator(
      stream as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>,
      (chunk) => chunk.choices[0]?.delta?.content ?? "",
    );
  }

  getContextWindow(): number {
    return 128000
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "OpenCode")
  }
}
