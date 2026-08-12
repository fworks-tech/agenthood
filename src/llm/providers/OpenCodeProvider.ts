import OpenAI from "openai";
import type { LLMConfig, Message, ToolSchema } from "../types.ts"
import { ChatCompletionsProvider } from "./chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "./chat-completions-provider.ts"
import type { ParamConverters } from "./openai-params.ts"
import { buildGoCompleteParams } from "./openai-params.ts"
import { DEFAULT_CONTEXT_WINDOW, OPENCODE_DEFAULT_MODEL } from "./constants.ts"

function toOpenAIMessages(messages: Message[]): unknown {
  return messages.map((msg) => {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content,
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      }))
    }
    if (msg.tool_call_id) base.tool_call_id = msg.tool_call_id
    if (msg.name) base.name = msg.name
    return base
  })
}

function toOpenAITools(tools: ToolSchema[]): unknown {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    },
  }))
}

const opencodeConverters: ParamConverters = {
  convertMessages: toOpenAIMessages,
  convertTools: toOpenAITools,
}

export class OpenCodeProvider extends ChatCompletionsProvider {
  constructor(config: LLMConfig, runtimeOptions: { goTier?: boolean } = {}) {
    const options: ChatCompletionsProviderOptions = {
      providerName: "OpenCode",
      apiKeyEnv: "OPENCODE_API_KEY",
      requireApiKey: true,
      signupUrl: "https://opencode.ai",
      baseUrlDefault: "https://opencode.ai/zen/v1",
      defaultModel: OPENCODE_DEFAULT_MODEL,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      converters: opencodeConverters,
      paramsBuilder: runtimeOptions.goTier ? buildGoCompleteParams : undefined,
      createClient: (apiKey, baseUrl) => new OpenAI({ apiKey, baseURL: baseUrl }),
    };
    super(config, options);
  }
}
