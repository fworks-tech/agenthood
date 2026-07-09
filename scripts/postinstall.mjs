import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

if (!process.env.AGENTHOOD_AUTO_SETUP) {
  process.exit(0)
}

const here = dirname(fileURLToPath(import.meta.url))
const cli = join(here, "..", "dist", "cli.js")

if (!existsSync(cli)) {
  process.exit(0)
}

const result = spawnSync(process.execPath, [cli, "setup"], { stdio: "inherit" })
process.exit(result.status ?? 0)
