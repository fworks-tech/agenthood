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
    expect(definition.steps.map((s) => s.name)).toEqual(["review:0:reviewer", "review:1:auditor"]);
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

  it("keeps the result of every step when one member appears twice", async () => {
    const outputs = ["first pass", "second pass"];
    const { runner: fake } = runner({ builder: () => outputs.shift() ?? "" });
    const results = await runChain(chain({ steps: [{ member: "builder" }, { member: "builder" }] }), "do it", options(fake));
    expect(results.map((r) => r.output)).toEqual(["first pass", "second pass"]);
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

const ORCHESTRATED = `chains:
  - name: release
    sequence:
      - member: reviewer
      - skill: git
      - skill: git
        agent: doorman
      - parallel:
          - member: auditor
          - member: warden
      - member: builder
        when: { step: reviewer, contains: "[blocking]" }
`;

describe('chain composition (#609)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'chains-compose-'));
    writeFileSync(join(dir, 'chains.yaml'), ORCHESTRATED);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses skill steps, parallel groups and conditions', () => {
    const [chain] = loadChains(dir);
    expect(chain.steps[1]).toEqual({ skill: 'git' });
    expect(chain.steps[2]).toEqual({ skill: 'git', agent: 'doorman' });
    expect(chain.steps[3].parallel).toEqual([{ member: 'auditor' }, { member: 'warden' }]);
    expect(chain.steps[4].when).toEqual({ step: 'reviewer', contains: '[blocking]' });
  });

  it('maps a skill step to /skill activation by its agent', () => {
    const definition = toWorkflowDefinition(loadChains(dir)[0], 'ship it');
    expect(definition.steps[1]).toMatchObject({
      name: 'release:1:git',
      type: 'agent',
      input: { member: 'builder', task: '/git ship it', skill: 'git' },
    });
    expect(definition.steps[2].input).toMatchObject({ member: 'doorman', task: '/git ship it' });
  });

  it('maps a parallel group to parallel sub-steps', () => {
    const definition = toWorkflowDefinition(loadChains(dir)[0], 'ship it');
    const group = definition.steps[3];
    expect(group.type).toBe('parallel');
    expect(group.subSteps?.map((s) => s.name)).toEqual(['release:3:parallel:0:auditor', 'release:3:parallel:1:warden']);
  });

  it('resolves a condition label to the generated step name', () => {
    const definition = toWorkflowDefinition(loadChains(dir)[0], 'ship it');
    expect(definition.steps[4].when).toEqual({ step: 'release:0:reviewer', contains: '[blocking]' });
  });

  it('gates a later step on a parallel branch', () => {
    writeFileSync(
      join(dir, 'chains.yaml'),
      `chains:
  - name: x
    sequence:
      - parallel:
          - member: reviewer
          - member: auditor
      - member: builder
        when: { step: reviewer, contains: "[blocking]" }
`,
    );
    const definition = toWorkflowDefinition(loadChains(dir)[0], 'task');
    expect(definition.steps[1].when).toEqual({ step: 'x:0:parallel:0:reviewer', contains: '[blocking]' });
  });

  it('rejects ambiguity, dangling conditions and conditional branches', () => {
    for (const body of [
      'chains:\n  - name: x\n    sequence:\n      - member: a\n        skill: b\n',
      'chains:\n  - name: x\n    sequence:\n      - parallel: []\n',
      'chains:\n  - name: x\n    sequence:\n      - member: a\n        when: { step: later, contains: x }\n',
      'chains:\n  - name: x\n    sequence:\n      - parallel:\n          - member: a\n            when: { step: a, contains: x }\n',
      'chains:\n  - name: x\n    sequence:\n      - parallel:\n          - member: a\n        task: group task\n',
    ]) {
      writeFileSync(join(dir, 'chains.yaml'), body);
      expect(() => loadChains(dir)).toThrow();
    }
  });
});

describe('runChain composition (#609)', () => {
  const runner = (outputs: Record<string, () => string>) => {
    const runMemberTask = vi.fn(async (member: string) => ({
      output: outputs[member]?.() ?? `${member} ok`,
      durationMs: 1,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }));
    return { runner: { runMemberTask } as unknown as Pick<MemberRunner, 'runMemberTask'>, runMemberTask };
  };

  const options = (runner: Pick<MemberRunner, 'runMemberTask'>) => ({
    runner,
    config: { provider: 'openai', model: 'm' } as LLMConfig,
    context: createTestContext(),
    log: () => {},
  });

  it('runs a skill step as a slash activation and reports the skill', async () => {
    const { runner: fake, runMemberTask } = runner({ builder: () => 'skill done' });
    const chain: ChainDefinition = { name: 'c', steps: [{ skill: 'git' }], guards: {}, maxRounds: 1 };
    const [result] = await runChain(chain, 'do it', options(fake));

    expect(runMemberTask.mock.calls[0]).toEqual(['builder', '/git do it', { provider: 'openai', model: 'm' }]);
    expect(result).toEqual({ member: 'builder', skill: 'git', output: 'skill done' });
  });

  it('skips a conditional step whose condition is false and reports it', async () => {
    const { runner: fake, runMemberTask } = runner({ reviewer: () => 'all good' });
    const chain: ChainDefinition = {
      name: 'c',
      steps: [{ member: 'reviewer' }, { member: 'builder', when: { step: 'reviewer', contains: '[blocking]' } }],
      guards: {},
      maxRounds: 1,
    };
    const results = await runChain(chain, 'do it', options(fake));

    expect(runMemberTask).toHaveBeenCalledTimes(1);
    expect(results[1]).toEqual({ member: 'builder', output: '', skipped: true });
  });

  it('runs a conditional step when its condition matches', async () => {
    const { runner: fake } = runner({ reviewer: () => '[blocking] fix this' });
    const chain: ChainDefinition = {
      name: 'c',
      steps: [{ member: 'reviewer' }, { member: 'builder', when: { step: 'reviewer', contains: '[blocking]' } }],
      guards: {},
      maxRounds: 1,
    };
    const results = await runChain(chain, 'do it', options(fake));
    expect(results[1]).toMatchObject({ member: 'builder', output: 'builder ok' });
    expect(results[1].skipped).toBeUndefined();
  });

  it('runs parallel branches and aggregates every result in chain order', async () => {
    const { runner: fake, runMemberTask } = runner({ auditor: () => 'audit', warden: () => 'scan' });
    const chain: ChainDefinition = {
      name: 'c',
      steps: [{ parallel: [{ member: 'auditor' }, { member: 'warden' }] }],
      guards: {},
      maxRounds: 1,
    };
    const results = await runChain(chain, 'do it', options(fake));

    expect(runMemberTask.mock.calls.map((c) => c[0]).sort()).toEqual(['auditor', 'warden']);
    expect(results.map((r) => r.output)).toEqual(['audit', 'scan']);
  });

  it('fails the group when a parallel branch fails', async () => {
    const runMemberTask = vi.fn(async (member: string) => {
      if (member === 'warden') throw new Error('warden exploded');
      return { output: 'ok', durationMs: 1, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    });
    const chain: ChainDefinition = {
      name: 'c',
      steps: [{ parallel: [{ member: 'auditor' }, { member: 'warden' }] }],
      guards: {},
      maxRounds: 1,
    };
    await expect(runChain(chain, 'do it', options({ runMemberTask } as never))).rejects.toThrow('warden exploded');
  });
});
