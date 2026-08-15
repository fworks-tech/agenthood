import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { healthCheck } from '../core/healthCheck.ts'
import type { HealthReport, HealthDeps } from '../core/healthCheck.ts'
import type { LLMConfig } from '../llm/types.ts'
import { MemberRegistry } from '../members/index.ts'
import { PROVIDER_KEYS } from '../llm/validateApiKeys.ts'
import { loadConfigOrExit } from './config.ts'
import type { CommandDescriptor } from './types.ts'

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

async function collectHealthDeps(cwd: string, config: LLMConfig): Promise<HealthDeps> {
  const tracesPath = resolveTraceStorePath(cwd, loadObservabilityConfig(cwd))
  const store = new JSONFileTraceStore(tracesPath)

  // real store state instead of a stub tracer that is always empty
  let traceCount = 0
  let storeOk = true
  try {
    traceCount = (await store.query()).length
  } catch {
    storeOk = false
  }

  const traceStoreProbe = async (): Promise<boolean> => storeOk

  const providers = (config.providers ?? []).map((p) => ({
    name: p.name,
    probe: async (): Promise<boolean> => {
      const keyInfo = PROVIDER_KEYS[p.name]
      if (!keyInfo) return true
      return Boolean(p.apiKey ?? process.env[keyInfo.envVar])
    },
  }))

  const rawConfig = loadObservabilityConfig(cwd)
  const retentionBlock = (rawConfig.observability as Record<string, unknown> | undefined)?.retention

  return {
    tracer: { size: storeOk ? traceCount : 0, capacity: 1000 },
    traceStoreProbe,
    memberCount: new MemberRegistry().list().length,
    providers,
    sentry: config.sentry,
    baselinesProbe: async () => existsSync(join(cwd, '.agenthood', 'baselines')),
    retentionProbe: async () => retentionBlock != null,
  }
}


export async function health(args: string[] = []): Promise<void> {
  const json = args.includes('--json')
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }

  const config = await loadConfigOrExit()
  const report = await healthCheck(await collectHealthDeps(process.cwd(), config))

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report)
  }

  process.exitCode = report.status === 'healthy' ? 0 : report.status === 'degraded' ? 1 : 2
}
