/**
 * src/commands/args.ts
 *
 * Shared argument parsing for commands that inspect the observability store
 * (trace, log). Kept here so `--since`/`--limit` semantics and error text stay
 * identical across commands instead of drifting into per-file copies.
 */

export interface StoreInspectArgs {
  member?: string
  limit: number
  since?: string
  json: boolean
  help: boolean
}

/**
 * Parses the flag vocabulary shared by `trace`/`log` (`--member`, `--limit`,
 * `--since`, `--json`, `--help`). Command-specific flags are handled by
 * `onFlag`, which returns true when it consumed a value-flag's argument.
 */
export function parseStoreInspectArgs(
  args: string[],
  onFlag?: (flag: string, value: string | undefined) => boolean,
  defaultLimit = 20,
): StoreInspectArgs {
  const out: StoreInspectArgs = { limit: defaultLimit, json: false, help: false }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const value = args[i + 1]
    switch (arg) {
      case '--member':
        out.member = value
        i++
        break
      case '--limit':
        out.limit = parseLimit(value)
        i++
        break
      case '--since':
        out.since = resolveSince(value ?? '')
        i++
        break
      case '--json':
        out.json = true
        break
      case '--help':
      case '-h':
        out.help = true
        break
      default:
        if (onFlag?.(arg, value) === true) i++
        break
    }
  }
  return out
}

export function resolveSince(value: string): string {
  const relative = /^(\d+)(m|h|d)$/.exec(value)
  if (relative) {
    const multiplier = relative[2] === 'm' ? 60_000 : relative[2] === 'h' ? 3_600_000 : 86_400_000
    return new Date(Date.now() - Number(relative[1]) * multiplier).toISOString()
  }
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) {
    console.error(`Invalid --since value: "${value}" — use an ISO date or 1h/24h/7d`)
    process.exit(1)
    return ''
  }
  return new Date(ts).toISOString()
}

export function parseLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    console.error('Invalid --limit value — expected a non-negative integer')
    process.exit(1)
  }
  return parsed
}