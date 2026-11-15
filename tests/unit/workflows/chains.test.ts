import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ChainBlockedError, loadChains, runChain, toWorkflowDefinition, type ChainDefinition } from "../../../src/workflows/chains.ts";
import { createTestContext } from "../../helpers/testContext.ts";
import type { LLMConfig } from "../../../src/llm/types.ts";
import type { MemberRunner } from "../../../src/runtime/MemberRunner.ts";

const BUILD = `chains:
  - name: build
    sequence:
      - member: tester
      - member: builder
        task: only the builder task
    guards: { stop_on_blocking: true }
    max_rounds: 3
`;

describe("chains.yaml", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "chains-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty list when the file is absent", () => {
    expect(loadChains(dir)).toEqual([]);
  });

  it("parses chains, guards and rounds", () => {
    writeFileSync(join(dir, "chains.yaml"), BUILD);
    const [chain] = loadChains(dir);
    expect(chain).toMatchObject({
      name: "build",
      maxRounds: 3,
      steps: [{ member: "tester" }, { member: "builder", task: "only the builder task" }],
      guards: { stop_on_blocking: true },
    });
  });

  it("defaults rounds to 1 and guards to off", () => {
    writeFileSync(join(dir, "chains.yaml"), "chains:\n  - name: quick\n    sequence:\n      - member: scribe\n");
    expect(loadChains(dir)[0]).toMatchObject({ maxRounds: 1, guards: { stop_on_blocking: false } });
  });

  it("fails closed on malformed entries", () => {
    for (const body of [
      "chains: 3\n",
      "chains:\n  - sequence:\n      - member: a\n",
      "chains:\n  - name: x\n    sequence: []\n",
      "chains:\n  - name: x\n    sequence:\n      - task: no member\n",
      "chains:\n  - name: x\n    sequence:\n      - member: a\n    max_rounds: 0\n",
    ]) {
      writeFileSync(join(dir, "chains.yaml"), body);
      expect(() => loadChains(dir)).toThrow();
    }
  });

  it("maps a chain to sequential agent steps", () => {
    const chain: ChainDefinition = {
      name: "review",
      steps: [{ member: "reviewer" }, { member: "auditor" }],
      guards: {},
      maxRounds: 1,
    };
    const definition = toWorkflowDefinition(chain, "shared task");
    expect(definition.steps.map((s) => s.name)).toEqual(["review:reviewer", "review:auditor"]);
    expect(definition.steps[0]).toMatchObject({ type: "agent", input: { member: "reviewer", task: "shared task" } });
  });
});

describe("runChain", () => {
  const chain = (over: Partial<ChainDefinition> = {}): ChainDefinition => ({
    name: "build",
    steps: [{ member: "tester" }, { member: "builder" }],
    guards: { stop_on_blocking: true },
    maxRounds: 1,
    ...over,
  });

  const runner = (outputs: Record<string, () => string>) => {
    const runMemberTask = vi.fn(async (member: string) => ({
      output: outputs[member]?.() ?? `${member} ok`,
      durationMs: 1,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }));
    return { runner: { runMemberTask } as unknown as Pick<MemberRunner, "runMemberTask">, runMemberTask };
  };

  const options = (runner: Pick<MemberRunner, "runMemberTask">) => ({
    runner,
    config: { provider: "openai", model: "m" } as LLMConfig,
    context: createTestContext(),
    log: () => {},
  });

  it("runs every step in order through MemberRunner and returns its output", async () => {
    const { runner: fake, runMemberTask } = runner({ tester: () => "tests pass" });
    const results = await runChain(chain(), "do it", options(fake));
    expect(runMemberTask.mock.calls.map((c) => c[0])).toEqual(["tester", "builder"]);
    expect(results[0]).toEqual({ member: "tester", output: "tests pass" });
  });

  it("stops the chain when a step reports a blocking finding", async () => {
    const { runner: fake, runMemberTask } = runner({ tester: () => "[blocking] broken" });
    await expect(runChain(chain(), "do it", options(fake))).rejects.toBeInstanceOf(ChainBlockedError);
    expect(runMemberTask).toHaveBeenCalledTimes(1);
  });

  it("re-runs the sequence while a blocking round leaves budget", async () => {
    let attempt = 0;
    const { runner: fake } = runner({ tester: () => (++attempt === 1 ? "[blocking] first" : "ok") });
    const results = await runChain(chain({ maxRounds: 2 }), "do it", options(fake));
    // round 1 blocks at the tester; round 2 runs both steps
    expect(attempt).toBe(2);
    expect(results.map((r) => r.member)).toEqual(["tester", "builder"]);
  });

  it("does not stop on a blocking marker when the guard is off", async () => {
    const { runner: fake } = runner({ tester: () => "[blocking] ignored" });
    await expect(runChain(chain({ guards: {} }), "do it", options(fake))).resolves.toHaveLength(2);
  });
});
