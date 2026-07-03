import Groq from "groq-sdk";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"
import { createStreamGenerator } from "./stream-utils.ts"
import { validateMessages, validateTools, parseToolCall, parseUsage } from "./validation.ts"
import { mapProviderError } from "./provider-errors.ts"

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  model: string;

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
    const startTime = Date.now();
    console.info(
      `[GroqProvider] complete() model=${this.model} messages=${request.messages.length}`,
    );

    const params = this.buildCommonParams(request);

    try {
      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("Groq API returned empty choices array");
      }

      const toolCalls = choice.message.tool_calls?.map(
        (tc) => parseToolCall(tc, "Groq"),
      );
      const result: LLMResponse = {
        content: choice.message.content ?? "",
        toolCalls,
        usage: parseUsage(response.usage),
        model: response.model,
      };

      console.info(
        `[GroqProvider] complete() ok model=${response.model} tokens=${result.usage.totalTokens} duration=${Date.now() - startTime}ms`,
      );
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[GroqProvider] complete() failed duration=${Date.now() - startTime}ms error=${msg}`,
      );
      throw mapProviderError(err, "Groq", this.model);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    console.info(
      `[GroqProvider] stream() model=${this.model} messages=${request.messages.length}`,
    );

    const stream = await this.client.chat.completions.create({
      ...this.buildCommonParams(request),
      stream: true,
    });

    return createStreamGenerator(
      stream as unknown as AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>,
      (chunk) => chunk.choices[0]?.delta?.content ?? "",
    );
  }

  private buildCommonParams(request: LLMRequest) {
    return {
      model: this.model,
      messages: validateMessages<Groq.Chat.Completions.ChatCompletionMessageParam[]>(request.messages),
      tools: validateTools<Groq.Chat.Completions.ChatCompletionTool[]>(request.tools),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.top_p,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
      stop: request.stop,
    };
  }

  getContextWindow(): number {
    return 128000;
  }

  setModel(model: string): void {
    this.model = model;
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "GroqProvider");
  }
}
