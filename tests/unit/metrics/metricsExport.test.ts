import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { AddressInfo } from 'node:net'
import { collectSnapshot, renderPrometheus, renderStatsD } from '../../../src/metrics/export.ts'
import { startMetricsServer } from '../../../src/metrics/server.ts'
import { loadMetricsExportConfig, exportIfConfigured } from '../../../src/metrics/config.ts'
import { logCost } from '../../../src/core/CostLogger.ts'
import { MetricsCollector } from '../../../src/memory/MetricsCollector.ts'
import type { Server } from 'node:http'

/** Real sockets on a real port. Vitest's 5s default is not enough headroom
 *  when the parallel worker pool is saturating the CPU — the same class of
 *  flake the command-registry test hit on CI (#465). */
const SOCKET_TIMEOUT = 15000

function seed(cwd: string): void {
  const metrics = new MetricsCollector(join(cwd, '.agenthood', 'metrics'))
  metrics.record('the-scribe', true, 1000)
  metrics.record('the-scribe', true, 3000)
  metrics.record('the-reviewer', false, 2000)
  logCost({
    timestamp: '2026-09-25T10:00:00Z', member: 'the-scribe', model: 'llama-3.3-70b', provider: 'groq',
    promptTokens: 100, completionTokens: 50, totalTokens: 150, costUsd: 0.0002,
  }, cwd)
  logCost({
    timestamp: '2026-09-25T11:00:00Z', member: 'the-reviewer', model: 'gpt-4o-mini', provider: 'openai',
    promptTokens: 200, completionTokens: 20, totalTokens: 220, costUsd: 0.0001,
  }, cwd)
}

describe('metrics export (#651)', () => {
  let cwd: string

  beforeEach(() => {
    cwd = join(tmpdir(), `agenthood-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(cwd, '.agenthood'), { recursive: true })
  })

  afterEach(() => rmSync(cwd, { recursive: true, force: true }))

  describe('collectSnapshot', () => {
    it('is empty for a project with no ledgers', () => {
      const snapshot = collectSnapshot(cwd)
      expect(snapshot.members).toEqual([])
      expect(snapshot.totalCostUsd).toBe(0)
    })

    it('rolls costs up per provider', () => {
      seed(cwd)
      const snapshot = collectSnapshot(cwd)
      expect(snapshot.costs).toEqual([
        { provider: 'groq', costUsd: 0.0002, tokens: 150 },
        { provider: 'openai', costUsd: 0.0001, tokens: 220 },
      ])
      expect(snapshot.totalTokens).toBe(370)
    })
  })

  describe('renderPrometheus', () => {
    it('emits cost, token, latency and success rate per provider and member', () => {
      seed(cwd)
      const text = renderPrometheus(collectSnapshot(cwd))
      expect(text).toContain('# TYPE agenthood_member_invocations_total counter')
      expect(text).toContain('agenthood_member_invocations_total{member="the-scribe"} 2')
      expect(text).toContain('agenthood_member_success_rate{member="the-scribe"} 1.000000')
      expect(text).toContain('agenthood_member_success_rate{member="the-reviewer"} 0.000000')
      expect(text).toContain('agenthood_member_duration_ms_avg{member="the-scribe"} 2000.000')
      expect(text).toContain('agenthood_provider_cost_usd_total{provider="groq"} 0.00020000')
      expect(text).toContain('agenthood_provider_tokens_total{provider="openai"} 220')
    })

    it('produces valid exposition: every non-comment line is `name value`', () => {
      seed(cwd)
      const text = renderPrometheus(collectSnapshot(cwd))
      expect(text.endsWith('\n')).toBe(true)
      for (const line of text.split('\n').filter((l) => l && !l.startsWith('#'))) {
        expect(line, line).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*(\{[^}]*\})? -?[0-9.]+$/)
      }
    })

    it('escapes label values that would otherwise break the format', () => {
      const snapshot = collectSnapshot(cwd)
      snapshot.members = [{ member: 'we"ird\\one', metrics: { invocations: 1, successes: 1, failures: 0, totalDurationMs: 1, lastRun: null } }]
      const text = renderPrometheus(snapshot)
      expect(text).toContain('member="we\\"ird\\\\one"')
    })

    it('is empty string with no data', () => {
      expect(renderPrometheus(collectSnapshot(cwd))).toBe('')
    })
  })

  describe('renderStatsD', () => {
    it('emits counters and gauges with sanitized names', () => {
      seed(cwd)
      const datagrams = renderStatsD(collectSnapshot(cwd))
      expect(datagrams).toContain('agenthood.member.the-scribe.invocations:2|c')
      expect(datagrams).toContain('agenthood.member.the-reviewer.failures:1|c')
      expect(datagrams).toContain('agenthood.provider.groq.cost_usd_total:0.00020000|c')
      expect(datagrams).toContain('agenthood.tokens_total:370|c')
    })

    it('sanitizes characters StatsD cannot carry in a metric name', () => {
      const snapshot = collectSnapshot(cwd)
      snapshot.members = [{ member: 'a b/c', metrics: { invocations: 1, successes: 1, failures: 0, totalDurationMs: 1, lastRun: null } }]
      expect(renderStatsD(snapshot)[0]).toBe('agenthood.member.a_b_c.invocations:1|c')
    })
  })

  describe('config', () => {
    it('defaults to none with no config file', () => {
      expect(loadMetricsExportConfig(cwd)).toEqual({ type: 'none', port: 9464, host: '127.0.0.1' })
    })

    it('rejects an unknown type instead of silently ignoring it', () => {
      writeFileSync(join(cwd, '.agenthood', 'config.json'), JSON.stringify({ metricsExport: { type: 'graphite' } }))
      expect(() => loadMetricsExportConfig(cwd)).toThrow(/metricsExport.type/)
    })

    it('reads port and host overrides', () => {
      writeFileSync(join(cwd, '.agenthood', 'config.json'), JSON.stringify({ metricsExport: { type: 'prometheus', port: 9999, host: '0.0.0.0' } }))
      expect(loadMetricsExportConfig(cwd)).toEqual({ type: 'prometheus', port: 9999, host: '0.0.0.0' })
    })

    it('exportIfConfigured is a no-op and never throws on a bad config', () => {
      writeFileSync(join(cwd, '.agenthood', 'config.json'), '{ not json')
      expect(() => exportIfConfigured(cwd)).not.toThrow()
    })
  })

  describe('server', () => {
    let server: Server
    let port: number

    afterEach(async () => {
      if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it('serves valid Prometheus text on /metrics', async () => {
      seed(cwd)
      server = await startMetricsServer({ cwd, port: 0 })
      port = (server.address() as AddressInfo).port
      const res = await fetch(`http://127.0.0.1:${port}/metrics`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/plain')
      const body = await res.text()
      expect(body).toContain('agenthood_member_invocations_total{member="the-scribe"} 2')
      expect(body).toContain('# TYPE agenthood_provider_cost_usd_total counter')
    }, SOCKET_TIMEOUT)

    it('404s anything but /metrics', async () => {
      server = await startMetricsServer({ cwd, port: 0 })
      port = (server.address() as AddressInfo).port
      const res = await fetch(`http://127.0.0.1:${port}/other`)
      expect(res.status).toBe(404)
    }, SOCKET_TIMEOUT)

    it('reflects new runs on the next scrape', async () => {
      seed(cwd)
      server = await startMetricsServer({ cwd, port: 0 })
      port = (server.address() as AddressInfo).port
      new MetricsCollector(join(cwd, '.agenthood', 'metrics')).record('the-scribe', false, 1000)
      const body = await (await fetch(`http://127.0.0.1:${port}/metrics`)).text()
      expect(body).toContain('agenthood_member_invocations_total{member="the-scribe"} 3')
    }, SOCKET_TIMEOUT)
  })
})
