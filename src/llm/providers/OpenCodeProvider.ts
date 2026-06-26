import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
  ToolCall,
} from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"

function parseToolCall(
  tc: OpenAI.Chat.ChatCompletionMessageToolCall,
): ToolCall {
  if (tc.type === "function") {
    try {
      return {
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      };
    } catch (parseErr) {
      throw new Error(
        `Invalid tool call JSON from OpenCode for ${tc.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }
  }
  return {
    id: tc.id,
    name: tc.custom.name,
    args: tc.custom.input,
  };
}

function toOpenAIMessages(
  messages: LLMRequest["messages"],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    }

    // Convert toolCalls (camelCase) -> tool_calls (snake_case) for OpenAI SDK
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

    // Pass through tool_call_id for tool result messages
    if (msg.tool_call_id) {
      base.tool_call_id = msg.tool_call_id
    }

    // Pass through name
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
      const toolCalls = message.tool_calls?.map(parseToolCall);

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
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenCodeProvider.complete() failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: toOpenAIMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    });

    async function* generate(): AsyncGenerator<LLMChunk> {
      for await (const chunk of stream as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        yield { delta, done: false };
      }
      yield { delta: "", done: true };
    }

    return generate();
  }

  getContextWindow(): number {
    return 128000
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "OpenCode")
  }
}
