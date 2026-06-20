import OpenAI from "openai";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type {
  LLMRequest,
  LLMResponse,
  LLMChunk,
  LLMConfig,
  ToolCall,
} from "../types.ts"

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
        `Invalid tool call JSON from OpenAI for ${tc.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      );
    }
  }
  return {
    id: tc.id,
    name: tc.custom.name,
    args: tc.custom.input,
  };
}

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
    this.model = config.model ?? "gpt-4o";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages:
          request.messages as unknown as OpenAI.Chat.ChatCompletionMessageParam[],
        tools: request.tools as unknown as OpenAI.Chat.ChatCompletionTool[],
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
      throw new Error(`OpenAIProvider.complete() failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages:
        request.messages as unknown as OpenAI.Chat.ChatCompletionMessageParam[],
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
