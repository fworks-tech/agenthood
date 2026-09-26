import { createSocket } from 'node:dgram'
import { collectSnapshot, renderStatsD } from './export.ts'

export interface StatsDOptions {
  host: string
  port: number
}

/** Fire-and-forget StatsD push. UDP with no retry: a monitoring packet that
 *  needs resending is not worth a queue, and a failure must never fail a run. */
export function pushStatsD(cwd: string, options: StatsDOptions): void {
  let datagrams: string[]
  try {
    datagrams = renderStatsD(collectSnapshot(cwd))
  } catch {
    return
  }
  if (datagrams.length === 0) return

  const socket = createSocket('udp4')
  socket.unref()
  socket.on('error', () => socket.close())
  for (const datagram of datagrams) {
    socket.send(Buffer.from(datagram), options.port, options.host, () => {})
  }
  socket.close()
}
