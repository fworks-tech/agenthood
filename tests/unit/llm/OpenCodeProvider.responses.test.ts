import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockResponsesCreate } = vi.hoisted(() => ({ mockResponsesCreate: vi.fn() }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    responses = { create: mockResponsesCreate };
  },
}));

import { OpenCodeProvider } from "../../../src/llm/providers/OpenCodeProvider.ts";

function provider() {
  return new OpenCodeProvider({ apiKey: "key" });
}

beforeEach(() => mockResponsesCreate.mockReset());

describe("OpenCodeProvider /v1/responses protocol (GPT, Grok, Muse)", () => {
  it("maps a responses output into text and tool calls", async () => {
    mockResponsesCreate.mockResolvedValue({
      output: [
        { type: "message", content: [{ type: "output_text", text: "hi " }] },
        { type: "function_call", call_id: "c1", name: "web_fetch", arguments: '{"url":"x"}' },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
      model: "gpt-5-nano",
    });
    const p = provider();
    p.setModel("gpt-5-nano");
    const res = await p.complete({ messages: [{ role: "user", content: "yo" }] });
    expect(res.content).toBe("hi ");
    expect(res.toolCalls).toEqual([{ id: "c1", name: "web_fetch", args: { url: "x" } }]);
    expect(res.usage).toMatchObject({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it("hoists the system message into instructions and round-trips tool results", async () => {
    mockResponsesCreate.mockResolvedValue({ output: [], usage: {} });
    const p = provider();
    p.setModel("gpt-5-nano");
    await p.complete({
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "yo" },
        { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "web_fetch", args: { url: "x" } }] },
        { role: "tool", content: "page", tool_call_id: "c1", name: "web_fetch" },
      ],
    });
    const body = mockResponsesCreate.mock.calls[0][0];
    expect(body.instructions).toBe("be terse");
    expect(body.input).toEqual([
      { role: "user", content: "yo" },
      { type: "function_call", call_id: "c1", name: "web_fetch", arguments: '{"url":"x"}' },
      { type: "function_call_output", call_id: "c1", output: "page" },
    ]);
  });

  it("streams output text deltas", async () => {
    mockResponsesCreate.mockResolvedValue((async function* () {
      yield { type: "response.output_text.delta", delta: "ab" };
      yield { type: "response.completed" };
      yield { type: "response.output_text.delta", delta: "cd" };
    })());
    const p = provider();
    p.setModel("gpt-5-nano");
    const gen = await p.stream({ messages: [{ role: "user", content: "yo" }] });
    let out = "";
    for await (const chunk of gen) out += chunk.delta;
    expect(out).toBe("abcd");
    expect(mockResponsesCreate.mock.calls[0][0].stream).toBe(true);
  });
});
