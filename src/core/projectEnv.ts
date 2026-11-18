import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

/**
 * Loads a project .env file. Values in the file win over inherited ones: the
 * OpenCode host injects its own OPENCODE_API_KEY into plugin children, and that
 * key cannot authenticate a standalone Agenthood run.
 */
export function loadProjectEnv(path = '.env', env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return
  Object.assign(env, parseEnv(readFileSync(path, 'utf8')))
}
