import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAnthCreate } = vi.hoisted(() => ({ mockAnthCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthCreate };
  },
}));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
  },
}));

import { OpenCodeProvider } from "../../../src/llm/providers/OpenCodeProvider.ts";
import { UnsupportedOperationError } from "../../../src/llm/errors.ts";

function provider() {
  return new OpenCodeProvider({ apiKey: "key" });
}

beforeEach(() => mockAnthCreate.mockReset());

describe("OpenCodeProvider /v1/messages protocol (qwen3.8-flash, Claude)", () => {
  it("maps an Anthropic response into the chat-completions shape", async () => {
    mockAnthCreate.mockResolvedValue({
      content: [
        { type: "text", text: "hi " },
        { type: "tool_use", id: "t1", name: "web_fetch", input: { url: "x" } },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
      model: "qwen3.8-flash",
    });
    const p = provider();
    p.setModel("qwen3.8-flash");
    const res = await p.complete({ messages: [{ role: "user", content: "yo" }] });
    expect(res.content).toBe("hi ");
    expect(res.toolCalls).toEqual([{ id: "t1", name: "web_fetch", args: { url: "x" } }]);
    expect(res.usage).toMatchObject({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it("hoists the system message and reports a 200k window for a messages model", async () => {
    mockAnthCreate.mockResolvedValue({ content: [{ type: "text", text: "ok" }], usage: {} });
    const p = provider();
    p.setModel("qwen3.8-flash");
    expect(p.getContextWindow()).toBe(200000);
    await p.complete({ messages: [{ role: "system", content: "be terse" }, { role: "user", content: "yo" }] });
    expect(mockAnthCreate.mock.calls[0][0].system).toBe("be terse");
  });

  it("streams text deltas", async () => {
    mockAnthCreate.mockResolvedValue((async function* () {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "ab" } };
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "cd" } };
    })());
    const p = provider();
    p.setModel("claude-sonnet-5");
    const gen = await p.stream({ messages: [{ role: "user", content: "yo" }] });
    let out = "";
    for await (const chunk of gen) out += chunk.delta;
    expect(out).toBe("abcd");
  });
});

describe("OpenCodeProvider rejects non-text Zen protocols with guidance", () => {
  it("Jev (systemone) is a decision model, not a chat turn", async () => {
    const p = provider();
    p.setModel("jev-1.13");
    await expect(p.complete({ messages: [{ role: "user", content: "yo" }] })).rejects.toThrow(
      UnsupportedOperationError,
    );
  });

  it("GPT (responses) is not implemented by this provider yet", async () => {
    const p = provider();
    p.setModel("gpt-6-sol");
    await expect(p.complete({ messages: [{ role: "user", content: "yo" }] })).rejects.toThrow(
      /\/v1\/responses/,
    );
  });
});
