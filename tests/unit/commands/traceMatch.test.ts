import { describe, it, expect } from "vitest";
import { matchTrajectories } from "../../../src/commands/trace.ts";
import type { Trajectory } from "../../../src/core/TrajectoryStore.ts";

function traj(id: string, steps: Trajectory["steps"], completedAt = "2026-01-01T00:00:00.000Z"): Trajectory {
  return {
    id,
    correlationId: id,
    member: "builder",
    task: "t",
    steps,
    totalTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
    startedAt: completedAt,
    completedAt,
  };
}

const step = (over: Partial<Trajectory["steps"][number]>) => ({
  step: 0,
  model: "m",
  inputSummary: "",
  outputSummary: "",
  tokens: { prompt: 0, completion: 0 },
  cost: 0,
  durationMs: 0,
  status: "success" as const,
  ...over,
});

describe("matchTrajectories", () => {
  const withSkill = traj("a", [step({ skills: ["builder"] })]);
  const withTool = traj("b", [step({ tools: [{ name: "read_file", input: "{}", output: "ok", status: "success" }] })]);
  const legacy = traj("c", [step({ tool: "write_file", toolInput: "{}", toolOutput: "ok" })]);

  it("filters by activated skill", () => {
    expect(matchTrajectories([withSkill, withTool], { skill: "builder" }).map((t) => t.id)).toEqual(["a"]);
  });

  it("filters by tool, including legacy single-tool steps", () => {
    expect(matchTrajectories([withSkill, withTool, legacy], { tool: "read_file" }).map((t) => t.id)).toEqual(["b"]);
    expect(matchTrajectories([withSkill, withTool, legacy], { tool: "write_file" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("returns everything when no filter is given, newest first", () => {
    const older = traj("old", [step({})], "2026-01-01T00:00:00.000Z");
    const newer = traj("new", [step({})], "2026-02-01T00:00:00.000Z");
    expect(matchTrajectories([older, newer], {}).map((t) => t.id)).toEqual(["new", "old"]);
  });
});
