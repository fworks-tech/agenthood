import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();

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

function respondJson(data: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("OpenCodeProvider /v1/messages protocol (qwen3.8-flash, Claude)", () => {
  it("maps an Anthropic response into the chat-completions shape", async () => {
    respondJson({
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

  it("authenticates with x-api-key, the header the Zen messages endpoint reads", async () => {
    // The Anthropic SDK sends every credential as Authorization Bearer, and
    // this endpoint ignores Bearer: live calls with a credential-shaped key
    // answered 401 "Missing API key" while the same key sent as x-api-key
    // reached it (PR #1089).
    respondJson({ content: [{ type: "text", text: "ok" }], usage: {} });
    const p = provider();
    p.setModel("qwen3.8-flash");
    await p.complete({ messages: [{ role: "user", content: "yo" }] });
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get("x-api-key")).toBe("key");
    expect(headers.has("authorization")).toBe(false);
  });

  it("hoists the system message and reports the catalog window for a messages model", async () => {
    respondJson({ content: [{ type: "text", text: "ok" }], usage: {} });
    const p = provider();
    p.setModel("qwen3.8-flash");
    expect(p.getContextWindow()).toBe(1000000);
    await p.complete({ messages: [{ role: "system", content: "be terse" }, { role: "user", content: "yo" }] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).system).toBe("be terse");
  });

  it("streams text deltas", async () => {
    const sse = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ab"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"cd"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join("");
    fetchMock.mockResolvedValue(
      new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
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
});
