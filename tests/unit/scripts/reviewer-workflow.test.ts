import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const workflow = readFileSync(
  join(import.meta.dirname, '..', '..', '..', '.github', 'workflows', 'reviewer.yml'),
  'utf8',
)

describe('reviewer workflow', () => {
  it('grounds the review in the diff', () => {
    expect(workflow).toContain('include-diff: "true"')
    expect(workflow).not.toContain('cannot see file contents')
  })

  it('keeps the gate on deterministic checks', () => {
    expect(workflow).toContain('gate-mode: "advisory"')
    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toContain('warning-threshold')
  })
})
