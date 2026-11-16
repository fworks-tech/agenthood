import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { JSONFileTraceStore, loadObservabilityConfig, resolveTraceStorePath } from '../core/TraceStore.ts'
import { healthCheck } from '../core/healthCheck.ts'
import type { HealthComponent, HealthReport, HealthDeps } from '../core/healthCheck.ts'
import { TrajectoryStore } from '../core/TrajectoryStore.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { readSkillStats } from '../skills/activation/SkillStats.ts'
import {
  detectRegressions,
  failingActivations,
  readBaseline,
  skillHealth,
  speedBySkill,
  writeBaseline,
} from '../skills/observability.ts'
import type { LLMConfig } from '../llm/types.ts'
import { MemberRegistry } from '../members/index.ts'
import { PROVIDER_KEYS } from '../llm/validateApiKeys.ts'
import { LLMRouter } from '../llm/LLMRouter.ts'
import { loadConfigOrExit } from './config.ts'
import type { CommandDescriptor } from './types.ts'

function printHelp(): void {
  console.log(`Usage:
  npx agenthood health [options]

Check the runtime health of the observability stack and member registry.

Options:
  --json        Machine-readable JSON output
  --baseline    Stamp the current skill step times as the regression baseline
  --help        Show this help

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
    traceCount = (await store.query()).filter((e) => e.entryType !== 'log').length
  } catch {
    storeOk = false
  }

  const traceStoreProbe = async (): Promise<boolean> => storeOk

  const providers = (config.providers ?? []).map((p) => ({
    name: p.name,
    probe: async (): Promise<boolean | { ok: boolean; detail?: string }> => {
      const keyInfo = PROVIDER_KEYS[p.name]
      const apiKey = p.apiKey ?? (keyInfo ? process.env[keyInfo.envVar] : undefined)
      if (!keyInfo) return { ok: true, detail: 'custom provider (no live probe)' }
      if (!apiKey) return { ok: false, detail: 'key missing' }
      if (process.env.AGENTHOOD_HEALTH_SKIP_PROBES) return { ok: true, detail: 'key available (live probe skipped)' }
      const started = performance.now()
      try {
        const provider = await LLMRouter.getProvider(p.name, { ...config, provider: p.name })
        if (!provider) return { ok: false, detail: 'provider not initializable' }
        // TODO: AbortController plumbing to cancel in-flight pings on timeout;
        // the CLI exits after health, so abandoned requests are bounded here.
        const res = await Promise.race([
          provider.complete({ messages: [{ role: 'user', content: 'ping' }] }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('probe timed out (15s)')), 15_000).unref()),
        ])
        if (!res?.content?.trim()) return { ok: false, detail: 'empty completion' }
        return { ok: true, detail: `responsive in ${Math.round(performance.now() - started)}ms` }
      } catch (err) {
        return { ok: false, detail: (err as Error).message }
      }
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
    skillChecks: () => collectSkillChecks(cwd),
  }
}

/** Per-skill checks (#597, #626, #627): they read local files, never the network. */
async function collectSkillChecks(cwd: string): Promise<HealthComponent[]> {
  const manifests = new SkillDiscovery().discover(cwd)
  // Errors first: the detail line only has room for three, and a missing
  // description matters more than a stale reference.
  const problems = skillHealth(manifests).sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
  const errors = problems.filter((problem) => problem.level === 'error')
  const warnings = problems.filter((problem) => problem.level === 'warn')

  const stats = readSkillStats(cwd)
  const failing = failingActivations(stats)

  const trajectories = new TrajectoryStore(cwd).list()
  const regressions = detectRegressions(speedBySkill(trajectories), readBaseline(cwd))

  return [
    {
      name: 'skills',
      status: errors.length > 0 ? 'degraded' : 'ok',
      detail:
        problems.length === 0
          ? `${manifests.length} skill(s) healthy`
          : `${errors.length} error(s), ${warnings.length} warning(s): ${problems
              .slice(0, 3)
              .map((problem) => `${problem.skill} — ${problem.message}`)
              .join('; ')}`,
    },
    {
      name: 'skillActivations',
      status: failing.length > 0 ? 'degraded' : 'ok',
      detail:
        failing.length === 0
          ? 'no skill below the success threshold'
          : failing.map((entry) => `${entry.skill} ${Math.round(entry.rate * 100)}% of ${entry.attempts}`).join(', '),
    },
    {
      name: 'skillRegressions',
      status: regressions.length > 0 ? 'degraded' : 'ok',
      detail:
        regressions.length === 0
          ? 'no step-time regression against the baseline'
          : regressions
              .map((regression) => `${regression.skill} +${Math.round(regression.change * 100)}%`)
              .join(', '),
    },
  ]
}

/**
 * Webhook alert when a skill check is degraded (#626). Opt-in: `alerts.webhook`
 * in `.agenthood/config.json` holds the URL. The payload carries both `text`
 * (Slack) and `content` (Discord); unknown keys are ignored by both.
 */
async function alertOnDegradedSkills(cwd: string, report: HealthReport): Promise<void> {
  const webhook = (loadObservabilityConfig(cwd).alerts as { webhook?: unknown } | undefined)?.webhook
  if (typeof webhook !== 'string' || !webhook.trim()) return

  const degraded = report.checks.filter((check) => check.name.startsWith('skill') && check.status !== 'ok')
  if (degraded.length === 0) return

  const message = degraded.map((check) => `${check.name}: ${check.detail ?? check.status}`).join('\n')
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `Agenthood skill alert
${message}`, content: `**Agenthood skill alert**
${message}` }),
    })
  } catch (err) {
    console.warn(`[health] alert webhook failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}


export async function health(args: string[] = []): Promise<void> {
  const json = args.includes('--json')
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return
  }

  if (args.includes('--baseline')) {
    const stamped = writeBaseline(process.cwd(), speedBySkill(new TrajectoryStore(process.cwd()).list()))
    const count = Object.keys(stamped).length
    console.log(
      count === 0
        ? 'No timed skill steps yet — run a member first, then stamp the baseline.'
        : `Skill baseline stamped for ${count} skill(s) → .agenthood/skill-baseline.json`,
    )
    return
  }

  const config = await loadConfigOrExit()
  const report = await healthCheck(await collectHealthDeps(process.cwd(), config))
  await alertOnDegradedSkills(process.cwd(), report)

  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report)
  }

  process.exitCode = report.status === 'healthy' ? 0 : report.status === 'degraded' ? 1 : 2
}
