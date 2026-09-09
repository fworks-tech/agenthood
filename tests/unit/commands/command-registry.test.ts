import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const commandsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../src/commands')

describe('command registry', () => {
  it('every command file exports a well-formed CommandDescriptor', async () => {
    // 15s headroom, and imports run concurrently: sequential await import()
    // over 26 cold modules makes the sum of load times time out under parallel
    // CPU load on CI (#465).
    const files = readdirSync(commandsDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    const mods = await Promise.all(
      files.map((file) => import(join(commandsDir, file)).then((mod) => [file, mod] as const)),
    )
    const names: string[] = []
    for (const [file, mod] of mods) {
      if (!mod.command) continue
      expect(mod.command.name, file).toBeTypeOf('string')
      expect(mod.command.name.length, file).toBeGreaterThan(0)
      expect(mod.command.description, file).toBeTypeOf('string')
      expect(mod.command.handler, file).toBeTypeOf('function')
      names.push(mod.command.name)
    }
    expect(names.sort()).toEqual([
      'activate', 'check', 'checkpoints', 'completion', 'deactivate', 'eject', 'eval', 'health', 'init', 'install', 'list', 'log', 'mcp', 'oath',
      'optimize', 'pr-sync', 'publish', 'rollback', 'run', 'search', 'setup', 'status', 'trace', 'upgrade', 'verify', 'workflow',
    ])
  }, 15000)

  it('helper modules (collectMetrics, prSyncHelpers) export no descriptor', async () => {
    const collectMetrics = await import(join(commandsDir, 'collectMetrics.ts'))
    const prSyncHelpers = await import(join(commandsDir, 'prSyncHelpers.ts'))
    expect(collectMetrics.command).toBeUndefined()
    expect(prSyncHelpers.command).toBeUndefined()
  })

  it('descriptor names are unique', async () => {
    const files = readdirSync(commandsDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    const mods = await Promise.all(files.map((file) => import(join(commandsDir, file))))
    const names = mods.filter((m) => m.command).map((m) => m.command.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
