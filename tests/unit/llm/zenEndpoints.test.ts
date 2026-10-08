import { describe, it, expect } from "vitest";
import { zenProtocolForModel, isZenMessagesModel } from "../../../src/llm/providers/zenEndpoints.ts";

describe("zenProtocolForModel", () => {
  it("routes message-protocol models", () => {
    for (const m of ["qwen3.8-flash", "claude-opus-5", "claude-haiku-4-5"]) {
      expect(zenProtocolForModel(m)).toBe("messages");
      expect(isZenMessagesModel(m)).toBe(true);
    }
  });
  it("routes Jev to systemone", () => {
    expect(zenProtocolForModel("jev-1.13")).toBe("systemone");
    expect(zenProtocolForModel("jev-1.13-free")).toBe("systemone");
  });
  it("routes GPT/Grok/Muse to responses", () => {
    for (const m of ["gpt-6-sol", "grok-4.7", "muse-spark-1.3"]) expect(zenProtocolForModel(m)).toBe("responses");
  });
  it("keeps Qwen split: max is chat, flash/plus are messages", () => {
    expect(zenProtocolForModel("qwen3.8-max")).toBe("chat");
    expect(zenProtocolForModel("qwen3.7-plus")).toBe("messages");
  });
  it("defaults the chat-completions families to chat", () => {
    for (const m of ["deepseek-v4-flash", "glm-5.3-flash", "kimi-k2.5", "minimax-m2.5", "mimo-v2.6-flash-free", "big-pickle"]) {
      expect(zenProtocolForModel(m)).toBe("chat");
    }
  });
});
