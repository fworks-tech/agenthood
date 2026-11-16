/**
 * One-off command references (#541, #545). A skill may point at a tool instead
 * of bundling it, but only with an explicit version: an unpinned command is a
 * moving dependency whose result the skill cannot reproduce or be audited for.
 */

export const ONE_OFF_PREFIXES = ['uvx', 'npx', 'pipx', 'cargo'] as const
export type OneOffPrefix = (typeof ONE_OFF_PREFIXES)[number]

export interface OneOffCommand {
  prefix: OneOffPrefix
  /** Executable and arguments, ready to spawn. */
  argv: string[]
  /** `tool@version` as written. */
  reference: string
}

export type OneOffResult = { ok: true; command: OneOffCommand } | { ok: false; error: string }

/** `--no-cache` maps to the runtime's own flag; cargo's store is content-addressed. */
const NO_CACHE_FLAG: Record<OneOffPrefix, string | undefined> = {
  uvx: '--no-cache',
  npx: '--prefer-online',
  pipx: undefined,
  cargo: undefined,
}

export function isOneOffReference(reference: string): boolean {
  return (ONE_OFF_PREFIXES as readonly string[]).includes(reference.trim().split(/\s+/, 1)[0] ?? '')
}

function splitVersion(token: string): { tool: string; version?: string } {
  const at = token.lastIndexOf('@')
  // A leading @ is a scope, not a version: @acme/tool@1.2.0.
  if (at <= 0) return { tool: token }
  return { tool: token.slice(0, at), version: token.slice(at + 1) }
}

/**
 * Parses `uvx ruff@0.8.0 check .`, `npx prettier@3.3.3 --write x`, `pipx run
 * black@24.1.0 .`, `cargo install ripgrep@14.0.0`. Splits on whitespace and
 * never evaluates a shell string.
 */
export function parseOneOffCommand(reference: string, noCache = false): OneOffResult {
  const tokens = reference.trim().split(/\s+/).filter(Boolean)
  const prefix = tokens[0] as OneOffPrefix | undefined
  if (!prefix || !(ONE_OFF_PREFIXES as readonly string[]).includes(prefix)) {
    return { ok: false, error: `Unsupported one-off command "${tokens[0] ?? ''}". Supported: ${ONE_OFF_PREFIXES.join(', ')}` }
  }

  let toolIndex = 1
  if (prefix === 'cargo') {
    if (tokens[1] !== 'install') {
      return { ok: false, error: 'cargo one-off commands must use `cargo install`.' }
    }
    toolIndex = 2
  }
  while (tokens[toolIndex]?.startsWith('-')) toolIndex++

  const token = tokens[toolIndex]
  if (!token) return { ok: false, error: `"${prefix}" needs a tool reference, e.g. ${prefix} tool@1.2.3` }

  const { tool, version } = splitVersion(token)
  if (!version) {
    return {
      ok: false,
      error: `Unpinned one-off command "${tool}". Pin the version (${tool}@1.2.3) so the skill stays reproducible.`,
    }
  }

  const cacheFlag = noCache ? NO_CACHE_FLAG[prefix] : undefined
  const argv = [prefix, ...(cacheFlag ? [cacheFlag] : []), ...tokens.slice(1)]
  return { ok: true, command: { prefix, argv, reference: token } }
}
