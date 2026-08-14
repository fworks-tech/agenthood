import { readFileSync } from 'node:fs'

export type HealthComponentStatus = 'ok' | 'degraded' | 'unhealthy'

export interface HealthComponent {
  name: string
  status: HealthComponentStatus
  detail?: string
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  uptimeMs: number
  checks: HealthComponent[]
}

export interface HealthDeps {
  tracer: { size: number; capacity: number }
  traceStoreProbe: () => Promise<boolean>
  memberCount: number
  /** Optional provider probes — omitted entirely when none are configured */
  providers?: Array<{ name: string; probe: () => Promise<boolean> }>
  /** Optional observability-config probes; each omitted check is skipped */
  sentry?: { dsn?: string }
  baselinesProbe?: () => Promise<boolean>
  retentionProbe?: () => Promise<boolean>
}

/**
 * Runs all component checks in parallel and derives the overall status:
 * any unhealthy check degrades the report to unhealthy, otherwise any
 * degraded check reports degraded.
 */
export async function healthCheck(deps: HealthDeps): Promise<HealthReport> {
  const [tracer, traceStore, memberRegistry, ...providerChecks] = await Promise.all([
    (async (): Promise<HealthComponent> => {
      const detail = `${deps.tracer.size}/${deps.tracer.capacity} envelopes`
      return {
        name: 'tracer',
        status: deps.tracer.size >= deps.tracer.capacity ? 'degraded' : 'ok',
        detail,
      }
    })(),
    (async (): Promise<HealthComponent> => {
      const reachable = await deps.traceStoreProbe()
      return { name: 'traceStore', status: reachable ? 'ok' : 'unhealthy', detail: reachable ? 'reachable' : 'unreachable' }
    })(),
    (async (): Promise<HealthComponent> => {
      return {
        name: 'memberRegistry',
        status: deps.memberCount > 0 ? 'ok' : 'degraded',
        detail: `${deps.memberCount} members`,
      }
    })(),
    ...(deps.providers ?? []).map(async (p): Promise<HealthComponent> => {
      const available = await p.probe()
      return { name: `provider:${p.name}`, status: available ? 'ok' : 'degraded', detail: available ? 'key available' : 'key missing' }
    }),
    ...(deps.sentry ? [sentryCheck(deps.sentry.dsn)] : []),
    ...(deps.baselinesProbe ? [probeCheck('baselines', deps.baselinesProbe, 'baselines present', 'no baselines — quality not stamped')] : []),
    ...(deps.retentionProbe ? [probeCheck('retention', deps.retentionProbe, 'policy configured', 'no retention policy — traces kept indefinitely')] : []),
  ])

  const checks = [tracer, traceStore, memberRegistry, ...providerChecks]
  const status = checks.some((c) => c.status === 'unhealthy')
    ? 'unhealthy'
    : checks.some((c) => c.status === 'degraded')
      ? 'degraded'
      : 'healthy'

  return { status, version: readVersion(), uptimeMs: Math.round(process.uptime() * 1000), checks }
}

function sentryCheck(dsn: string | undefined): HealthComponent {
  if (!dsn) return { name: 'sentry', status: 'ok', detail: 'not configured' }
  const valid = dsn.startsWith('http')
  return {
    name: 'sentry',
    status: valid ? 'ok' : 'degraded',
    detail: valid ? 'configured' : 'invalid DSN',
  }
}

async function probeCheck(
  name: string,
  probe: () => Promise<boolean>,
  presentDetail: string,
  absentDetail: string,
): Promise<HealthComponent> {
  const present = await probe()
  // absence is the default fresh-project state, so it informs without failing
  return { name, status: 'ok', detail: present ? presentDetail : absentDetail }
}

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
