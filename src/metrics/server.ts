import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { collectSnapshot, renderPrometheus } from './export.ts'

export const DEFAULT_METRICS_PORT = 9464

export interface MetricsServerOptions {
  cwd: string
  port?: number
}

/** Serves `/metrics` in Prometheus text format. Renders from the local
 *  ledgers on every scrape, so the endpoint never serves stale numbers. */
export function startMetricsServer(options: MetricsServerOptions): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('not found\n')
      return
    }
    const body = renderPrometheus(collectSnapshot(options.cwd))
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' })
    res.end(body)
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? DEFAULT_METRICS_PORT, () => resolve(server))
  })
}
