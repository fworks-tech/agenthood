import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
  ToolCall,
} from "../types.ts"
import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  ServiceUnavailableError,
  ModelNotFoundError,
} from "../errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"

function parseToolCall(
  tc: OpenAI.Chat.ChatCompletionMessageToolCall,
): ToolCall {
  if (tc.type !== "function") {
    throw new Error(`Unknown tool call type: ${tc.type}`);
  }
  try {
    return {
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments),
    };
  } catch (parseErr) {
    throw new Error(
      `Invalid tool call JSON from OpenAI for ${tc.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    );
  }
}

function validateMessages(messages: LLMRequest["messages"]): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }
  for (const m of messages) {
    if (!m || typeof m !== "object" || typeof m.role !== "string") {
      throw new Error("each message must have a role");
    }
  }
  return messages as OpenAI.Chat.ChatCompletionMessageParam[];
}

function validateTools(
  tools: LLMRequest["tools"],
): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools) return undefined;
  if (!Array.isArray(tools)) {
    throw new Error("tools must be an array");
  }
  for (const t of tools) {
    if (!t || typeof t !== "object" || typeof t.name !== "string") {
      throw new Error("each tool must have a name");
    }
  }
  return tools as unknown as OpenAI.Chat.ChatCompletionTool[];
}

function mapOpenAIError(err: unknown, model: string): Error {
  if (err instanceof OpenAI.APIError) {
    const status = err.status
    if (status === 401) return new AuthError("OpenAI")
    if (status === 429) return new RateLimitedError("OpenAI")
    if (status === 408 || status === 504) return new TimeoutError("OpenAI")
    if (status === 404) return new ModelNotFoundError("OpenAI", model)
    if (status >= 500) return new ServiceUnavailableError("OpenAI")
  }
  if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("timeout") || err.message?.includes("timed out"))) {
    return new TimeoutError("OpenAI")
  }
  return err instanceof Error ? err : new Error(String(err))
}

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? "gpt-5.4";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: validateMessages(request.messages),
        tools: validateTools(request.tools),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop ?? undefined,
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
      throw mapOpenAIError(err, this.model);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: validateMessages(request.messages),
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

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      return response.data[0].embedding;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`OpenAIProvider.embed() failed: ${msg}`);
    }
  }
}
