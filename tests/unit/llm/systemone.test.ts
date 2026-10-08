import { describe, it, expect, vi, afterEach } from "vitest";
import { decideWithJev, chooseWithJev } from "../../../src/llm/systemone.ts";

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({ ok, status, json: async () => body });
}

describe("decideWithJev", () => {
  it("is null with no API key (never blocks a run)", async () => {
    delete process.env.OPENCODE_API_KEY;
    expect(await decideWithJev("state", { q: { type: "noul", instructions: "?" } })).toBeNull();
  });
  it("posts typed questions to /systemone and returns answers", async () => {
    const f = respond({ answers: { q: { value: true, probability: 0.9 } } });
    vi.stubGlobal("fetch", f);
    const r = await decideWithJev("s", { q: { type: "noul", instructions: "?" } }, { apiKey: "k" });
    expect(r).toEqual({ q: { value: true, probability: 0.9 } });
    expect(f.mock.calls[0][0]).toBe("https://opencode.ai/zen/v1/systemone");
  });
  it("is null on a non-2xx (e.g. 402 insufficient funds)", async () => {
    vi.stubGlobal("fetch", respond({}, false, 402));
    expect(await decideWithJev("s", { q: { type: "noul", instructions: "?" } }, { apiKey: "k" })).toBeNull();
  });
  it("is null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await decideWithJev("s", { q: { type: "noul", instructions: "?" } }, { apiKey: "k" })).toBeNull();
  });
});

describe("chooseWithJev", () => {
  it("maps a valid choice to a clamped 0-100 probability", async () => {
    vi.stubGlobal("fetch", respond({ answers: { choice: { value: "b", probability: 0.82 } } }));
    expect(await chooseWithJev("s", ["a", "b"], { apiKey: "k" })).toEqual({ value: "b", probability: 82 });
  });
  it("is null when the model picks something outside the options", async () => {
    vi.stubGlobal("fetch", respond({ answers: { choice: { value: "ghost", probability: 0.99 } } }));
    expect(await chooseWithJev("s", ["a", "b"], { apiKey: "k" })).toBeNull();
  });
  it("is null for empty options without a network call", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await chooseWithJev("s", [], { apiKey: "k" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
