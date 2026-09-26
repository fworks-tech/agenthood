import type { CommandDescriptor } from './types.ts'
import { userError } from '../core/cliError.ts'
import { loadMetricsExportConfig } from '../metrics/config.ts'
import { collectSnapshot, renderPrometheus, renderStatsD } from '../metrics/export.ts'
import { DEFAULT_METRICS_PORT, startMetricsServer } from '../metrics/server.ts'

export const command: CommandDescriptor = {
  name: 'metrics',
  description: 'Export member and cost metrics to Prometheus or StatsD',
  handler: (args) => metricsHandler(args),
}

async function metricsHandler(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const portIndex = args.indexOf('--port')
  const overridePort = portIndex >= 0 ? Number(args[portIndex + 1]) : undefined
  if (overridePort !== undefined && !Number.isInteger(overridePort)) {
    throw userError('--port requires an integer')
  }

  let config
  try {
    config = loadMetricsExportConfig(cwd)
  } catch (err) {
    throw userError((err as Error).message)
  }

  if (args.includes('--print') || args.includes('--dry-run')) {
    const snapshot = collectSnapshot(cwd)
    if (config.type === 'statsd') {
      for (const datagram of renderStatsD(snapshot)) console.log(datagram)
    } else {
      process.stdout.write(renderPrometheus(snapshot))
    }
    return
  }

  if (config.type === 'none') {
    console.log('\n  metricsExport is not enabled. Set `metricsExport.type` to "prometheus" or "statsd"')
    console.log('  in .agenthood/config.json, or run with --print to render the snapshot once.\n')
    return
  }

  if (config.type === 'statsd') {
    console.log(`\n  StatsD export is push-based — it fires after every member run.`)
    console.log(`  Target: ${config.host}:${config.port}`)
    console.log('  Use --print to inspect what would be sent.\n')
    return
  }

  const port = overridePort ?? config.port ?? DEFAULT_METRICS_PORT
  const server = await startMetricsServer({ cwd, port })
  const address = server.address()
  const boundPort = typeof address === 'object' && address ? address.port : port
  console.log(`\n  Prometheus metrics on http://${config.host}:${boundPort}/metrics`)
  console.log('  Press Ctrl+C to stop.\n')

  const stop = () => {
    server.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
