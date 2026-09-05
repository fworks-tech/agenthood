import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const commandsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../src/commands')

describe('command registry', () => {
  it('every command file exports a well-formed CommandDescriptor', async () => {
    // 15s: cold dynamic imports of every command module under parallel load
    const files = readdirSync(commandsDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    const names: string[] = []
    for (const file of files) {
      const mod = await import(join(commandsDir, file))
      if (!mod.command) continue
      expect(mod.command.name, file).toBeTypeOf('string')
      expect(mod.command.name.length, file).toBeGreaterThan(0)
      expect(mod.command.description, file).toBeTypeOf('string')
      expect(mod.command.handler, file).toBeTypeOf('function')
      names.push(mod.command.name)
    }
    expect(names.sort()).toEqual([
      'activate', 'check', 'deactivate', 'eject', 'eval', 'health', 'init', 'install', 'list', 'log', 'oath',
      'pr-sync', 'rollback', 'run', 'setup', 'status', 'trace', 'verify', 'workflow',
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
    const names: string[] = []
    for (const file of files) {
      const mod = await import(join(commandsDir, file))
      if (mod.command) names.push(mod.command.name)
    }
    expect(new Set(names).size).toBe(names.length)
  })
})
