import Groq from "groq-sdk";
import type { ILLMProvider } from "../ILLMProvider.ts"
import type { LLMRequest, LLMResponse, LLMChunk, LLMConfig } from "../types.ts"
import { UnsupportedOperationError } from "../errors.ts"

function validateMessages(messages: LLMRequest["messages"]): Groq.Chat.Completions.ChatCompletionMessageParam[] {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }
  for (const m of messages) {
    if (!m || typeof m !== "object" || typeof m.role !== "string") {
      throw new Error("each message must have a role");
    }
  }
  return messages as Groq.Chat.Completions.ChatCompletionMessageParam[];
}

function validateTools(
  tools: LLMRequest["tools"],
): Groq.Chat.Completions.ChatCompletionTool[] | undefined {
  if (!tools) return undefined;
  if (!Array.isArray(tools)) {
    throw new Error("tools must be an array");
  }
  for (const t of tools) {
    if (!t || typeof t !== "object" || typeof t.name !== "string") {
      throw new Error("each tool must have a name");
    }
  }
  return tools as unknown as Groq.Chat.Completions.ChatCompletionTool[];
}

function parseToolCalls(toolCalls: Groq.Chat.Completions.ChatCompletionMessage["tool_calls"]) {
  return toolCalls?.map((tc) => {
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
}

function parseUsage(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined) {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

export class GroqProvider implements ILLMProvider {
  private client: Groq;
  private _model: string;

  constructor(config: LLMConfig) {
    this.client = new Groq({
      apiKey: config.apiKey ?? process.env.GROQ_API_KEY ?? "",
    });
    this._model =
      config.model ??
      process.env.GROQ_DEFAULT_MODEL ??
      "llama-3.3-70b-versatile";
  }

  get model(): string {
    return this._model;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    console.info(
      `[GroqProvider] complete() model=${this._model} messages=${request.messages.length}`,
    );

    const params = this.buildCommonParams(request);

    try {
      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("Groq API returned empty choices array");
      }

      const toolCalls = parseToolCalls(choice.message.tool_calls);
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
      throw new Error(`GroqProvider.complete() failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>> {
    console.info(
      `[GroqProvider] stream() model=${this._model} messages=${request.messages.length}`,
    );

    const stream = await this.client.chat.completions.create({
      ...this.buildCommonParams(request),
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

  private buildCommonParams(request: LLMRequest) {
    return {
      model: this._model,
      messages: validateMessages(request.messages),
      tools: validateTools(request.tools),
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
    this._model = model;
  }

  async embed(_text: string): Promise<number[]> {
    throw new UnsupportedOperationError("embed", "GroqProvider");
  }
}
