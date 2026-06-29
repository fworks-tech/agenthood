import Groq from "groq-sdk";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new Groq({
      apiKey: config.apiKey ?? process.env.GROQ_API_KEY ?? "",
    });
    this.model =
      config.model ??
      process.env.GROQ_DEFAULT_MODEL ??
      "llama-3.3-70b-versatile";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages:
          request.messages as unknown as Groq.Chat.Completions.ChatCompletionMessageParam[],
        tools:
          request.tools as unknown as Groq.Chat.Completions.ChatCompletionTool[],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stop: request.stop,
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map((tc) => {
        try {
          return {
            id: tc.id,
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          };
        } catch (parseErr) {
          throw new Error(
            `Invalid tool call JSON from Groq for ${tc.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          );
        }
      });

      return {
        content: choice.message.content ?? "",
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
      throw new Error(`GroqProvider.complete() failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages:
        request.messages as unknown as Groq.Chat.Completions.ChatCompletionMessageParam[],
      tools:
        request.tools as unknown as Groq.Chat.Completions.ChatCompletionTool[],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    });

    async function* generate(): AsyncGenerator<LLMChunk> {
      for await (const chunk of stream as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        yield { delta, done: false };
      }
      yield { delta: "", done: true };
    }

    return generate();
  }

  getContextWindow(): number {
    return 8192
  }

  setModel(model: string): void {
    this.model = model
  }

  async embed(text: string): Promise<number[]> {
    void text; // embed not supported
    throw new UnsupportedOperationError("embed", "GroqProvider");
  }
}
