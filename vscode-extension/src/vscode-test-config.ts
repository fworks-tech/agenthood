import * as path from "node:path";
import type { TestConfiguration } from "@vscode/test-cli";

const extensionRoot = path.resolve(__dirname, "..");
const testDir = path.join(extensionRoot, "dist");
const srcDir = path.join(extensionRoot, "src");

export = [
  {
    label: "unit-tests",
    version: "insiders",
    extensionDevelopmentPath: extensionRoot,
    srcDir,
    files: "**/*.test.js",
  },
];
