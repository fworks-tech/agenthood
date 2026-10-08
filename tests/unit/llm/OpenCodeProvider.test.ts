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

// Helper to create a provider with optional session env var
describe("OpenCodeProvider constructor", () => {
  beforeEach(() => {
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_CLIENT_SESSION;
  });

  afterEach(() => {
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_CLIENT_SESSION;
  });

  it("uses config.apiKey if provided", () => {
    const provider = new OpenCodeProvider({ apiKey: "custom-key" });
    expect(provider).toBeDefined();
  });

  it("falls back to OPENCODE_API_KEY env var when no client session", () => {
    process.env.OPENCODE_API_KEY = "env-key";
    delete process.env.OPENCODE_CLIENT_SESSION;
    const provider = new OpenCodeProvider({});
    expect(provider).toBeDefined();
  });

  it("does not require API key when OPENCODE_CLIENT_SESSION is set", () => {
    process.env.OPENCODE_CLIENT_SESSION = "test-session-123";
    delete process.env.OPENCODE_API_KEY;
    const provider = new OpenCodeProvider({});
    expect(provider).toBeDefined();
  });

  it("throws MissingApiKeyError when no key is set and no client session", () => {
    delete process.env.OPENCODE_CLIENT_SESSION;
    delete process.env.OPENCODE_API_KEY;
    expect(() => new OpenCodeProvider({})).toThrow(MissingApiKeyError);
  });

  it("throws a clear message naming the env var when no key is set and no client session", () => {
    delete process.env.OPENCODE_CLIENT_SESSION;
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

  it("maps timeout-named errors to TimeoutError", async () => {
    const err = new Error("connect failed") as Error & { code?: string };
    err.name = "TimeoutError";
    mockCreate.mockRejectedValue(err);
    const provider = new OpenCodeProvider({ apiKey: "key" });

    await expect(provider.stream({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      TimeoutError,
    );
  });
});
