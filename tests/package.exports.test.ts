import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Deep import paths hosts rely on (Atlaslink is the first consumer). A rename
 * that breaks them breaks an in-process embed, which no unit test would notice.
 */
const CONTRACT = [
  "runtime/ApplicationContext",
  "llm/types",
  "checkpoint/RunCheckpoint",
  "core/RunEventBus",
  "tools/human/AskHumanTool",
  "commands/config",
  "llm/validateApiKeys",
];

describe("package deep exports", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8")) as {
    exports?: Record<string, string>
    files?: string[]
  };

  it("maps every contract path in package.json exports", () => {
    for (const name of CONTRACT) {
      const target = `./dist/${name}.js`;
      expect(pkg.exports?.[target], `missing export "${target}"`).toBe(target);
    }
  });

  it("still has a source module for every exported deep path", () => {
    for (const name of CONTRACT) {
      expect(existsSync(join(ROOT, "src", `${name}.ts`)), `missing src/${name}.ts`).toBe(true);
    }
  });

  it("ships dist and the public root entry", () => {
    expect(pkg.files).toContain("dist");
    expect(pkg.exports?.["."]).toBe("./dist/opencode-plugin.js");
  });
});
