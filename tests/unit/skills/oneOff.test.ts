import { describe, it, expect } from 'vitest'
import { isOneOffReference, parseOneOffCommand } from '../../../src/skills/execution/oneOff.ts'

describe('one-off command pinning (#541, #545)', () => {
  it('accepts a pinned uvx reference', () => {
    const result = parseOneOffCommand('uvx ruff@0.8.0 check .')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.command.argv).toEqual(['uvx', 'ruff@0.8.0', 'check', '.'])
  })

  it('refuses an unpinned reference and says how to fix it', () => {
    const result = parseOneOffCommand('npx prettier --write src')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Pin the version')
  })

  it('reads the version after a scoped package name', () => {
    const result = parseOneOffCommand('npx @acme/cli@1.2.3 --json')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.command.reference).toBe('@acme/cli@1.2.3')
  })

  it('requires cargo install', () => {
    expect(parseOneOffCommand('cargo ripgrep@14.0.0').ok).toBe(false)
    const result = parseOneOffCommand('cargo install ripgrep@14.0.0')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.command.argv).toEqual(['cargo', 'install', 'ripgrep@14.0.0'])
  })

  it('refuses a prefix outside the supported set', () => {
    expect(parseOneOffCommand('docker run alpine@3').ok).toBe(false)
  })

  it('maps --no-cache to the runtime flag it actually has', () => {
    const npx = parseOneOffCommand('npx prettier@3.3.3 .', true)
    expect(npx.ok && npx.command.argv[1]).toBe('--prefer-online')
    const uvx = parseOneOffCommand('uvx ruff@0.8.0 .', true)
    expect(uvx.ok && uvx.command.argv[1]).toBe('--no-cache')
    const pipx = parseOneOffCommand('pipx black@24.1.0 .', true)
    expect(pipx.ok && pipx.command.argv[1]).toBe('black@24.1.0')
  })

  it('detects a one-off reference by its first token only', () => {
    expect(isOneOffReference('uvx ruff@0.8.0')).toBe(true)
    expect(isOneOffReference('scripts/run.py')).toBe(false)
    expect(isOneOffReference('  npx prettier@3 .')).toBe(true)
  })
})
