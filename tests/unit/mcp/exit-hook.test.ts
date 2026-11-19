import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOST = fileURLToPath(new URL('../../fixtures/mcp-exit-host.ts', import.meta.url))
const FIXTURE = fileURLToPath(new URL('../../fixtures/mcp-fixture-server.mjs', import.meta.url))

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('MCP child processes on host exit', () => {
  it('kills a started server when the host exits without closing it', () => {
    const host = spawnSync(process.execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', HOST, FIXTURE], { encoding: 'utf8', timeout: 20_000 })
    expect(host.status).toBe(0)
    const pid = Number(host.stdout.trim())
    expect(Number.isInteger(pid)).toBe(true)
    const deadline = Date.now() + 5_000
    while (alive(pid) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
    }
    expect(alive(pid)).toBe(false)
  })
})
