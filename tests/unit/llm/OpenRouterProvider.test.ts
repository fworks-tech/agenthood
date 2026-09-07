import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenRouterProvider } from "../../../src/llm/providers/OpenRouterProvider.ts";
import {
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_CONTEXT_WINDOW,
  OPENROUTER_EMBEDDING_MODEL,
} from "../../../src/llm/providers/constants.ts";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const mockCreate = vi.fn();
const mockEmbeddings = vi.fn();
const clientCfg: { current?: Record<string, unknown> } = {};
vi.mock("openai", () => ({
  default: class MockOpenAI {
    constructor(cfg: Record<string, unknown>) {
      clientCfg.current = cfg;
    }
    chat = { completions: { create: mockCreate } };
    embeddings = { create: mockEmbeddings };
  },
}));

function chatCompletion(text: string) {
  return {
    choices: [{ message: { content: text, tool_calls: undefined } }],
    usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    model: OPENROUTER_DEFAULT_MODEL,
  };
}

function req(overrides?: Record<string, unknown>) {
  return { messages: [{ role: "user", content: "hi" }], ...overrides } as never;
}

describe("OpenRouterProvider wiring (#671)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockEmbeddings.mockReset();
    clientCfg.current = undefined;
  });

  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY;
  });

  it("points the client at the OpenRouter base URL by default", () => {
    new OpenRouterProvider({ apiKey: "or-key" });
    expect(clientCfg.current).toMatchObject({
      apiKey: "or-key",
      baseURL: OPENROUTER_BASE_URL,
    });
  });

  it("honours an explicit baseUrl override", () => {
    new OpenRouterProvider({ apiKey: "k", baseUrl: "https://custom/api" });
    expect(clientCfg.current).toMatchObject({ baseURL: "https://custom/api" });
  });

  it("defaults to the OpenRouter model when config omits one", async () => {
    mockCreate.mockResolvedValue(chatCompletion("ok"));
    await new OpenRouterProvider({ apiKey: "k" }).complete(req());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: OPENROUTER_DEFAULT_MODEL });
  });

  it("reads OPENROUTER_API_KEY from the environment", () => {
    process.env.OPENROUTER_API_KEY = "env-or";
    new OpenRouterProvider({});
    expect(clientCfg.current).toMatchObject({ apiKey: "env-or" });
  });

  it("reports the OpenRouter context window", () => {
    expect(new OpenRouterProvider({ apiKey: "k" }).getContextWindow()).toBe(
      OPENROUTER_CONTEXT_WINDOW,
    );
  });

  it("embeds via the OpenRouter embedding model", async () => {
    mockEmbeddings.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    const vec = await new OpenRouterProvider({ apiKey: "k" }).embed("hello");
    expect(vec).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbeddings.mock.calls[0][0]).toMatchObject({
      model: OPENROUTER_EMBEDDING_MODEL,
      input: "hello",
    });
  });
});

describe("OpenRouterProvider complete behaviour", () => {
  beforeEach(() => mockCreate.mockReset());

  it("returns content + usage on a successful completion", async () => {
    mockCreate.mockResolvedValue(chatCompletion("pong"));
    const res = await new OpenRouterProvider({ apiKey: "k" }).complete(req());
    expect(res.content).toBe("pong");
    expect(res.usage).toMatchObject({ promptTokens: 3, completionTokens: 4, totalTokens: 7 });
  });

  it("setModel switches the model on subsequent calls", async () => {
    mockCreate.mockResolvedValue(chatCompletion("ok"));
    const p = new OpenRouterProvider({ apiKey: "k" });
    p.setModel("anthropic/claude-3.5-sonnet");
    await p.complete(req());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ model: "anthropic/claude-3.5-sonnet" });
  });

  // Error-status classification (401/429/404/…) is provider-agnostic and already
  // covered at its source in provider-errors.test.ts, so it is not re-asserted here.
});
