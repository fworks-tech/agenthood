import { describe, it, expect } from "vitest";
import { buildCatalog, getBundledCatalog, getCatalogModel } from "../../../src/llm/providers/opencodeCatalog.ts";
import { OPENCODE_DEFAULT_MODEL } from "../../../src/llm/providers/constants.ts";

const raw = (id: string, price: number, api = "chat-completions") => ({
  id,
  api: { [api]: {} },
  limit: { context: 1000 },
  cost: { text: { input: { price }, output: { price } } },
});

describe("bundled OpenCode catalog", () => {
  it("validates and contains the default model", () => {
    expect(getBundledCatalog().models.length).toBeGreaterThan(0);
    expect(getCatalogModel(OPENCODE_DEFAULT_MODEL)).toBeDefined();
  });

  it("looks up models with or without the opencode/ prefix", () => {
    expect(getCatalogModel("gpt-5-nano")).toMatchObject({ input: 0.05, output: 0.4, apis: ["responses"] });
    expect(getCatalogModel("opencode/gpt-5-nano")).toMatchObject({ input: 0.05, output: 0.4 });
    expect(getCatalogModel("not-a-real-model")).toBeUndefined();
  });
});

describe("buildCatalog", () => {
  it("keeps the first entry on duplicate ids and sorts by id", () => {
    const { catalog } = buildCatalog([raw("b-model", 2), raw("a-model", 1), raw("b-model", 9)]);
    expect(catalog.models.map((m) => m.id)).toEqual(["a-model", "b-model"]);
    expect(catalog.models[1].input).toBe(2);
  });

  it("skips entries that fail validation and reports them", () => {
    const { catalog, skipped } = buildCatalog([raw("ok-model", 1), { id: "broken" }, null]);
    expect(catalog.models.map((m) => m.id)).toEqual(["ok-model"]);
    expect(skipped).toEqual(["broken", "invalid"]);
  });

  it("builds context tiers from overrides, keyed by context.gt", () => {
    const tiered = {
      id: "tiered",
      api: { messages: {} },
      cost: {
        text: {
          input: { price: 1, overrides: [{ when: { context: { gt: 100 } }, price: 4 }] },
          output: { price: 2, overrides: [{ when: { context: { gt: 100 } }, price: 8 }] },
        },
      },
    };
    const { catalog } = buildCatalog([tiered]);
    expect(catalog.models[0].tiers).toEqual([{ above: 100, input: 4, output: 8 }]);
  });
});
