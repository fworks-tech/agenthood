import { describe, it, expect } from "vitest";
import { zenProtocolForModel, isZenMessagesModel } from "../../../src/llm/providers/zenEndpoints.ts";

describe("zenProtocolForModel", () => {
  it("routes message-protocol models from the catalog", () => {
    for (const m of ["qwen3.8-flash", "claude-opus-5", "claude-haiku-5-5", "opencode/claude-haiku-5-5"]) {
      expect(zenProtocolForModel(m)).toBe("messages");
      expect(isZenMessagesModel(m)).toBe(true);
    }
  });
  it("routes Jev to systemone", () => {
    expect(zenProtocolForModel("jev-1.13")).toBe("systemone");
    expect(zenProtocolForModel("jev-1.13-free")).toBe("systemone");
  });
  it("routes responses models from the catalog", () => {
    for (const m of ["gpt-5-nano", "gpt-6-sol", "grok-4.7", "muse-spark-1.3"]) expect(zenProtocolForModel(m)).toBe("responses");
  });
  it("keeps Qwen split: max is chat, flash is messages", () => {
    expect(zenProtocolForModel("qwen3.8-max")).toBe("chat");
    expect(zenProtocolForModel("qwen3.8-flash")).toBe("messages");
  });
  it("routes chat-completions models to chat", () => {
    for (const m of ["kimi-k2.5", "minimax-m2.5", "mimo-v2.6-flash-free", "big-pickle", "glm-5.3-flash"]) {
      expect(zenProtocolForModel(m)).toBe("chat");
    }
  });
  it("defaults unknown models to chat", () => {
    expect(zenProtocolForModel("not-a-real-model")).toBe("chat");
  });
  it("marks generate-content models so the provider can reject them", () => {
    expect(zenProtocolForModel("gemini-3.5-flash")).toBe("generate-content");
  });
});
