import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenCodeGoProvider } from "../../../src/llm/providers/OpenCodeGoProvider.ts"
import type { LLMRequest } from "../../../src/llm/types.ts"

const mockCreate = vi.fn();
const mockCtorArgs: Array<Record<string, unknown>> = [];
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
    constructor(...args: unknown[]) {
      mockCtorArgs.push(args[0] as Record<string, unknown>);
    }
  },
}));

function goProvider() {
  return new OpenCodeGoProvider({ apiKey: "test-key" });
}

describe("OpenCodeGoProvider", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCtorArgs.length = 0;
  });

  it("points at the Go subscription endpoint", () => {
    goProvider();
    expect(mockCtorArgs.at(-1)).toMatchObject({ baseURL: "https://opencode.ai/zen/go/v1" });
  });

  it("strips sampling extras that the Go proxy rejects (400)", async () => {
    const provider = goProvider();
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "hi" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const request: LLMRequest = {
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      maxTokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: ["STOP"],
      tools: [{ name: "t", description: "d", inputSchema: { type: "object" } }],
    };
    await provider.complete(request);
    const body = mockCreate.mock.calls[0][0];
    expect(body).toMatchObject({ model: "deepseek-v4-flash" });
    expect(body).toHaveProperty("tools");
    expect(body).toHaveProperty("temperature", 0.7);
    expect(body).toHaveProperty("max_tokens", 2048);
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("frequency_penalty");
    expect(body).not.toHaveProperty("presence_penalty");
    expect(body).not.toHaveProperty("stop");
  });

  it("keeps full sampling params on the standard OpenCode provider", async () => {
    const { OpenCodeProvider } = await import("../../../src/llm/providers/OpenCodeProvider.ts");
    mockCreate.mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "hi" } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const provider = new OpenCodeProvider({ apiKey: "test-key" });
    await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
      frequency_penalty: 0,
      stop: ["STOP"],
    });
    const body = mockCreate.mock.calls[0][0];
    expect(body).toHaveProperty("frequency_penalty", 0);
    expect(body).toHaveProperty("stop", ["STOP"]);
    expect(mockCtorArgs.at(-1)).toMatchObject({ baseURL: "https://opencode.ai/zen/v1" });
  });
});
