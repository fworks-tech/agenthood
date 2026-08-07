import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeProvider } from "../../../src/llm/providers/OpenCodeProvider.ts"
import { MissingApiKeyError } from "../../../src/llm/validateApiKeys.ts"
import { RateLimitedError, TimeoutError, AuthError } from "../../../src/llm/errors.ts"

// Mock the OpenAI SDK used by OpenCodeProvider
const mockCreate = vi.fn();
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

function makeSdkError(status: number, message = "api error") {
  const err = new Error(message) as Error & { status?: number; headers?: Record<string, string | undefined> };
  err.status = status;
  return err;
}

describe("OpenCodeProvider constructor", () => {
  beforeEach(() => {
    delete process.env.OPENCODE_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENCODE_API_KEY;
  });

  it("uses config.apiKey if provided", () => {
    const provider = new OpenCodeProvider({ apiKey: "custom-key" });
    expect(provider).toBeDefined();
  });

  it("falls back to OPENCODE_API_KEY env var", () => {
    process.env.OPENCODE_API_KEY = "env-key";
    const provider = new OpenCodeProvider({});
    expect(provider).toBeDefined();
  });

  it("throws MissingApiKeyError when no key is set", () => {
    expect(() => new OpenCodeProvider({})).toThrow(MissingApiKeyError);
  });

  it("throws a clear message naming the env var", () => {
    expect(() => new OpenCodeProvider({})).toThrow(/OPENCODE_API_KEY/);
  });
});

describe("OpenCodeProvider stream error mapping", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("maps 429 to RateLimitedError with retry-after", async () => {
    const err = makeSdkError(429, "rate limited");
    err.headers = { "retry-after": "5" };
    mockCreate.mockRejectedValue(err);
    const provider = new OpenCodeProvider({ apiKey: "key" });

    await expect(provider.stream({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      RateLimitedError,
    );
  });

  it("maps 401 to AuthError", async () => {
    mockCreate.mockRejectedValue(makeSdkError(401, "unauthorized"));
    const provider = new OpenCodeProvider({ apiKey: "key" });

    await expect(provider.stream({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      AuthError,
    );
  });

  it("maps timeout messages to TimeoutError", async () => {
    mockCreate.mockRejectedValue(new Error("request timed out"));
    const provider = new OpenCodeProvider({ apiKey: "key" });

    await expect(provider.stream({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      TimeoutError,
    );
  });
});
