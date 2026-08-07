import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenCodeProvider } from "../../../src/llm/providers/OpenCodeProvider.ts"
import { MissingApiKeyError } from "../../../src/llm/validateApiKeys.ts"

// Mock the OpenAI SDK used by OpenCodeProvider
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  },
}));

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
