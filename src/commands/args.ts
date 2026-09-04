/**
 * src/commands/args.ts
 *
 * Shared argument parsing for commands that inspect the observability store
 * (trace, log). Kept here so `--since`/`--limit` semantics stay identical
 * across commands instead of drifting into per-file copies.
 */

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