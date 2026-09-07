import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnthropicProvider } from "../../../src/llm/providers/AnthropicProvider.ts";
import { UnsupportedOperationError } from "../../../src/llm/errors.ts";

// Mock the Anthropic SDK: the provider only ever touches `client.messages.create`.
const mockCreate = vi.fn();
const ctorCfg: { current?: Record<string, unknown> } = {};
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(cfg: Record<string, unknown>) {
      ctorCfg.current = cfg;
    }
    messages = { create: mockCreate };
  },
}));

function response(content: unknown[], usage: Record<string, unknown> = {}, model = "claude-test") {
  return { content, usage: { input_tokens: 10, output_tokens: 5, ...usage }, model };
}

function req(overrides?: Record<string, unknown>) {
  return { messages: [{ role: "user", content: "hi" }], ...overrides } as never;
}

describe("AnthropicProvider constructor / basics", () => {
  beforeEach(() => mockCreate.mockReset());
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("passes the config apiKey to the SDK client", () => {
    new AnthropicProvider({ apiKey: "sk-ant-1" });
    expect(ctorCfg.current).toMatchObject({ apiKey: "sk-ant-1" });
  });

  it("falls back to ANTHROPIC_API_KEY when config has no key", () => {
    process.env.ANTHROPIC_API_KEY = "env-ant";
    new AnthropicProvider({});
    expect(ctorCfg.current).toMatchObject({ apiKey: "env-ant" });
  });

  it("reports a 200k context window", () => {
    expect(new AnthropicProvider({ apiKey: "k" }).getContextWindow()).toBe(200000);
  });

  it("setModel changes the model used on the next call", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "x" }]));
    const p = new AnthropicProvider({ apiKey: "k" });
    p.setModel("claude-opus-4");
    await p.complete(req());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: "claude-opus-4" });
  });

  it("embed() is unsupported and throws", async () => {
    await expect(new AnthropicProvider({ apiKey: "k" }).embed("t")).rejects.toThrow(
      UnsupportedOperationError,
    );
  });
});

describe("AnthropicProvider.complete()", () => {
  beforeEach(() => mockCreate.mockReset());

  it("joins text blocks into content and maps usage + model", async () => {
    mockCreate.mockResolvedValue(
      response([{ type: "text", text: "Hello " }, { type: "text", text: "world" }], {
        cache_creation_input_tokens: 3,
        cache_read_input_tokens: 7,
      }, "claude-sonnet-4"),
    );
    const res = await new AnthropicProvider({ apiKey: "k" }).complete(req());
    expect(res.content).toBe("Hello world");
    expect(res.toolCalls).toBeUndefined();
    expect(res.model).toBe("claude-sonnet-4");
    expect(res.usage).toMatchObject({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 7,
    });
  });

  it("omits cache token fields when the SDK does not report them", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "hi" }]));
    const res = await new AnthropicProvider({ apiKey: "k" }).complete(req());
    expect(res.usage.cacheCreationInputTokens).toBeUndefined();
    expect(res.usage.cacheReadInputTokens).toBeUndefined();
  });

  it("converts tool_use blocks into toolCalls", async () => {
    mockCreate.mockResolvedValue(
      response([{ type: "tool_use", id: "tu_1", name: "read_file", input: { path: "a.ts" } }]),
    );
    const res = await new AnthropicProvider({ apiKey: "k" }).complete(req());
    expect(res.toolCalls).toEqual([{ id: "tu_1", name: "read_file", args: { path: "a.ts" } }]);
  });

  it("caches the system prompt and forwards sampling params + stop sequences", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "ok" }]));
    await new AnthropicProvider({ apiKey: "k" }).complete(
      req({
        messages: [{ role: "system", content: "be terse" }, { role: "user", content: "hi" }],
        maxTokens: 123,
        temperature: 0.2,
        top_p: 0.9,
        stop: ["END"],
      }),
    );
    const params = mockCreate.mock.calls[0][0];
    expect(params.max_tokens).toBe(123);
    expect(params.temperature).toBe(0.2);
    expect(params.top_p).toBe(0.9);
    expect(params.stop_sequences).toEqual(["END"]);
    // system becomes a two-block cache-controlled array
    expect(params.system[0]).toMatchObject({ type: "text", text: "be terse" });
    expect(params.system[1].cache_control).toEqual({ type: "ephemeral" });
  });

  it("defaults max_tokens to 4096 when unset", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "ok" }]));
    await new AnthropicProvider({ apiKey: "k" }).complete(req());
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(4096);
  });

  it("maps a tool result message to a user tool_result block", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "ok" }]));
    await new AnthropicProvider({ apiKey: "k" }).complete(
      req({ messages: [{ role: "tool", name: "tu_1", content: "file contents" }] }),
    );
    const { messages } = mockCreate.mock.calls[0][0];
    expect(messages[0]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "tu_1", content: "file contents" }],
    });
  });

  it("maps an assistant message with toolCalls to text + tool_use blocks", async () => {
    mockCreate.mockResolvedValue(response([{ type: "text", text: "ok" }]));
    await new AnthropicProvider({ apiKey: "k" }).complete(
      req({
        messages: [
          {
            role: "assistant",
            content: "reading",
            toolCalls: [{ id: "tu_9", name: "read_file", args: { p: 1 } }],
          },
        ],
      }),
    );
    const { messages } = mockCreate.mock.calls[0][0];
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toContainEqual({
      type: "tool_use",
      id: "tu_9",
      name: "read_file",
      input: { p: 1 },
    });
  });
});

describe("AnthropicProvider.stream()", () => {
  beforeEach(() => mockCreate.mockReset());

  async function collect(gen: AsyncGenerator<{ delta: string; done: boolean }>) {
    const out: string[] = [];
    for await (const c of gen) if (!c.done) out.push(c.delta);
    return out.join("");
  }

  function eventStream(events: unknown[]) {
    return (async function* () {
      for (const e of events) yield e;
    })();
  }

  it("requests a streaming call and yields text deltas, ending with done", async () => {
    mockCreate.mockResolvedValue(
      eventStream([
        { type: "content_block_delta", delta: { type: "text_delta", text: "He" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "llo" } },
      ]),
    );
    const gen = await new AnthropicProvider({ apiKey: "k" }).stream(req());
    expect(mockCreate.mock.calls[0][0].stream).toBe(true);
    expect(await collect(gen)).toBe("Hello");
  });

  it("ignores non-text deltas", async () => {
    mockCreate.mockResolvedValue(
      eventStream([
        { type: "content_block_delta", delta: { type: "thinking_delta", text: "hmm" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "real" } },
        { type: "message_stop" },
      ]),
    );
    const gen = await new AnthropicProvider({ apiKey: "k" }).stream(req());
    expect(await collect(gen)).toBe("real");
  });
});
