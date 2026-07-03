import type { LLMRequest, ToolCall } from "../types.ts"

export function validateMessages<T>(
  messages: LLMRequest["messages"],
): T {
  if (!Array.isArray(messages)) {
    throw new Error("messages must be an array");
  }
  for (const m of messages) {
    if (!m || typeof m !== "object" || typeof m.role !== "string") {
      throw new Error("each message must have a role");
    }
  }
  return messages as unknown as T;
}

export function validateTools<T>(
  tools: LLMRequest["tools"],
): T | undefined {
  if (!tools) return undefined;
  if (!Array.isArray(tools)) {
    throw new Error("tools must be an array");
  }
  for (const t of tools) {
    if (!t || typeof t !== "object" || typeof t.name !== "string") {
      throw new Error("each tool must have a name");
    }
  }
  return tools as unknown as T;
}

export function parseToolCall(
  tc: { id: string; type: string; function: { name: string; arguments: string } },
  providerName: string,
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
      `Invalid tool call JSON from ${providerName} for ${tc.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    );
  }
}

export function parseUsage(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
} | undefined) {
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}
