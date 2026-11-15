import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOL_VOCABULARY, toRegistryToolNames } from "../../../src/members/toolVocabulary.ts";

describe("tool vocabulary", () => {
  it("translates declared skill tools to registry names", () => {
    expect(toRegistryToolNames(["file.read", "file.write", "code.refactor"])).toEqual([
      "read_file",
      "write_file",
      "refactor",
    ]);
  });

  it("passes unknown names through and leaves undefined undefined", () => {
    expect(toRegistryToolNames(["custom_tool"])).toEqual(["custom_tool"]);
    expect(toRegistryToolNames(undefined)).toBeUndefined();
  });

  it("covers every tool the bundled skills declare", () => {
    const skillsDir = join(process.cwd(), "skills");
    const declared = new Set<string>();
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      let text: string;
      try {
        text = readFileSync(join(skillsDir, entry.name, "SKILL.md"), "utf-8");
      } catch {
        continue;
      }
      const line = text.split(/\r?\n/).find((l) => l.startsWith("allowed-tools:"));
      if (!line) continue;
      for (const tool of line.replace("allowed-tools:", "").trim().split(/[\s,]+/)) {
        if (tool) declared.add(tool);
      }
    }
    const unknown = [...declared].filter((t) => !(t in TOOL_VOCABULARY));
    expect(unknown).toEqual([]);
  });
});
