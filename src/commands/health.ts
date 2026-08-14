import { join } from 'node:path'

import { JSONFileTraceStore } from '../core/TraceStore.js'
import { Tracer } from '../core/Tracer.ts'
import { healthCheck } from '../core/healthCheck.ts'
import type { HealthReport, HealthDeps } from '../core/healthCheck.ts'
import { MemberRegistry } from '../members/index.ts'
import { PROVIDER_KEYS } from '../llm/validateApiKeys.ts'
import { loadConfig } from './run.js'
import type { CommandDescriptor } from './types.js'

function printHelp(): void {
  console.log(`Usage:
  npx agenthood health [options]

Check the runtime health of the observability stack and member registry.

Options:
  --json    Machine-readable JSON output
  --help    Show this help

Exit codes:
  0  healthy
  1  degraded
  2  unhealthy
`)
}

function printReport(report: HealthReport): void {
  console.log(`\n  Agenthood Health — v${report.version}\n`)
  for (const check of report.checks) {
    const icon = check.status === 'ok' ? 'ok' : check.status === 'degraded' ? 'degraded' : 'unhealthy'
    const detail = check.detail ? ` — ${check.detail}` : ''
    console.log(`  ${icon.padEnd(9)} ${check.name}${detail}`)
  }
  console.log(`\n  Overall: ${report.status.toUpperCase()}\n`)
}

export const command: CommandDescriptor = {
  name: 'health',
  description: 'Check runtime health (tracer, trace store, registry, providers)',
  handler: (args) => health(args),
}

async function collectHealthDeps(cwd: string, config: Awaited<ReturnType<typeof loadConfig>>): Promise<HealthDeps> {
  const tracer = new Tracer(1000)

  const tracesPath = join(cwd, '.agenthood', 'traces', 'traces.ndjson')
  const traceStoreProbe = async (): Promise<boolean> => {
    try {
      const store = new JSONFileTraceStore(tracesPath)
      await store.query()
      return true
    } catch {
      return false
    }
  }

  const providers = (config.providers ?? []).map((p) => ({
    name: p.name,
    probe: async (): Promise<boolean> => {
      const keyInfo = PROVIDER_KEYS[p.name]
      if (!keyInfo) return true
      return Boolean(p.apiKey ?? process.env[keyInfo.envVar])
    },
  }))

  return {
    tracer: { size: tracer.size, capacity: tracer.capacity },
    traceStoreProbe,
    memberCount: new MemberRegistry().list().length,
    providers,
  }
}

export async function health(args: string[] = []): Promise<void> {
  const json = args.includes('--json')
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }

  const config = await loadConfig()
  const report = await healthCheck(await collectHealthDeps(process.cwd(), config))

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report)
  }

  process.exitCode = report.status === 'healthy' ? 0 : report.status === 'degraded' ? 1 : 2
}
