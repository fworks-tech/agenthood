import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatCompletionsProvider } from "../../../src/llm/providers/chat-completions-provider.ts"
import type { ChatCompletionsProviderOptions } from "../../../src/llm/providers/chat-completions-provider.ts"
import type { LLMConfig, LLMRequest } from "../../../src/llm/types.ts"
import { UnsupportedOperationError } from "../../../src/llm/errors.ts"
import { MissingApiKeyError } from "../../../src/llm/validateApiKeys.ts"
import { RateLimitedError, AuthError } from "../../../src/llm/errors.ts"

const mockCreate = vi.fn();

function fakeClient() {
  return { chat: { completions: { create: mockCreate } } };
}

class TestProvider extends ChatCompletionsProvider {
  constructor(config: LLMConfig, overrides: Partial<ChatCompletionsProviderOptions> = {}) {
    super(config, {
      providerName: "Test",
      apiKeyEnv: "TEST_API_KEY",
      defaultModel: "test-default",
      contextWindow: 64000,
      createClient: () => fakeClient(),
      ...overrides,
    });
  }
}

function makeSdkError(status: number, message = "api error") {
  const err = new Error(message) as Error & { status?: number; headers?: Record<string, string | undefined> };
  err.status = status;
  return err;
}

function mockResponse(content = "ok") {
  return {
    choices: [{ message: { content, tool_calls: undefined } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    model: "test-model",
  };
}

const req: LLMRequest = { messages: [{ role: "user", content: "hi" }] };

describe("ChatCompletionsProvider", () => {
  beforeEach(() => {
    delete process.env.TEST_API_KEY;
    delete process.env.TEST_MODEL;
    mockCreate.mockReset();
  });

  describe("constructor", () => {
    it("throws MissingApiKeyError when requireApiKey and no key resolves", () => {
      expect(
        () => new TestProvider({}, { requireApiKey: true, signupUrl: "https://example.com" }),
      ).toThrow(MissingApiKeyError);
    });

    it("resolves apiKey from env when config does not provide it", () => {
      process.env.TEST_API_KEY = "env-key";
      const provider = new TestProvider({});
      expect(provider).toBeDefined();
    });

    it("resolves model from config.model over envModelVar and defaultModel", () => {
      process.env.TEST_MODEL = "env-model";
      const provider = new TestProvider({ model: "config-model" }, { envModelVar: "TEST_MODEL" });
      expect((provider as unknown as { _model: string })._model).toBe("config-model");
    });

    it("resolves model from envModelVar when config.model is unset", () => {
      process.env.TEST_MODEL = "env-model";
      const provider = new TestProvider({}, { envModelVar: "TEST_MODEL" });
      expect((provider as unknown as { _model: string })._model).toBe("env-model");
    });

    it("defaults to defaultModel when nothing else resolves", () => {
      const provider = new TestProvider({});
      expect((provider as unknown as { _model: string })._model).toBe("test-default");
    });
  });

  describe("complete()", () => {
    it("returns content and usage from the SDK response", async () => {
      mockCreate.mockResolvedValue(mockResponse("hello"));
      const provider = new TestProvider({ apiKey: "k" });

      const response = await provider.complete(req);
      expect(response.content).toBe("hello");
      expect(response.usage.totalTokens).toBe(2);
    });

    it("maps 429 to RateLimitedError", async () => {
      const err = makeSdkError(429, "rate limited");
      err.headers = { "retry-after": "3" };
      mockCreate.mockRejectedValue(err);
      const provider = new TestProvider({ apiKey: "k" });

      await expect(provider.complete(req)).rejects.toThrow(RateLimitedError);
    });

    it("maps 401 to AuthError", async () => {
      mockCreate.mockRejectedValue(makeSdkError(401, "unauthorized"));
      const provider = new TestProvider({ apiKey: "k" });

      await expect(provider.complete(req)).rejects.toThrow(AuthError);
    });
  });

  describe("stream()", () => {
    it("uses complete params when streamUsesCompleteParams is set", async () => {
      mockCreate.mockResolvedValue(async function* () {}());
      const provider = new TestProvider({ apiKey: "k" }, { streamUsesCompleteParams: true });
      await provider.stream(req);
      const [params] = mockCreate.mock.calls[0];
      expect(params).toHaveProperty("tools");
      expect(params).toHaveProperty("top_p");
    });

    it("uses stream params by default (no tools, no penalties)", async () => {
      mockCreate.mockResolvedValue(async function* () {}());
      const provider = new TestProvider({ apiKey: "k" });
      await provider.stream(req);
      const [params] = mockCreate.mock.calls[0];
      expect(params).not.toHaveProperty("tools");
      expect(params).not.toHaveProperty("top_p");
    });
  });

  describe("setModel / getContextWindow", () => {
    it("updates the model used by subsequent requests", async () => {
      mockCreate.mockResolvedValue(mockResponse());
      const provider = new TestProvider({ apiKey: "k" });
      provider.setModel("new-model");
      await provider.complete(req);
      expect(mockCreate.mock.calls[0][0].model).toBe("new-model");
    });

    it("returns the configured context window", () => {
      const provider = new TestProvider({ apiKey: "k" });
      expect(provider.getContextWindow()).toBe(64000);
    });
  });

  describe("embed()", () => {
    it("throws UnsupportedOperationError by default", async () => {
      const provider = new TestProvider({ apiKey: "k" });
      await expect(provider.embed("text")).rejects.toThrow(UnsupportedOperationError);
    });
  });
});
