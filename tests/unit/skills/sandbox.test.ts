import { describe, it, expect, afterEach } from 'vitest'
import {
  detectDocker,
  sandboxDockerArgs,
  sandboxRequired,
  setDockerAvailable,
} from '../../../src/skills/execution/sandbox.ts'

afterEach(() => {
  setDockerAvailable(undefined)
})

describe('sandbox trust rule (#536, #607)', () => {
  it('runs an official skill on the host', () => {
    expect(sandboxRequired({ tier: 'official' }, { sandbox: false, trustedAuthors: [] }).required).toBe(false)
  })

  it('requires isolation for a community skill', () => {
    const decision = sandboxRequired({ tier: 'community' }, { sandbox: false, trustedAuthors: [] })
    expect(decision.required).toBe(true)
    expect(decision.reason).toContain('--sandbox')
  })

  it('lets a trusted author run on the host', () => {
    expect(
      sandboxRequired({ tier: 'community', owner: 'acme' }, { sandbox: false, trustedAuthors: ['acme'] }).required,
    ).toBe(false)
  })

  it('always isolates when sandboxing is requested', () => {
    expect(sandboxRequired({ tier: 'official' }, { sandbox: true, trustedAuthors: [] }).required).toBe(true)
  })

  it('fails closed when Docker is missing', () => {
    setDockerAvailable(false)
    expect(detectDocker()).toBe(false)
  })

  it('denies network and mounts only the skill directory read-only', () => {
    const args = sandboxDockerArgs('/tmp/skill', ['python3', 'scripts/x.py'])
    expect(args).toContain('--network')
    expect(args[args.indexOf('--network') + 1]).toBe('none')
    expect(args).toContain('--read-only')
    expect(args).toContain('--cap-drop')
    expect(args[args.indexOf('-v') + 1]).toBe('/tmp/skill:/skill:ro')
    expect(args.slice(-2)).toEqual(['python3', 'scripts/x.py'])
  })
})
