import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const workflow = read('.github/workflows/reviewer.yml')
const action = read('.github/actions/agent-analysis/action.yml')
const analysis = read('.github/scripts/agent-analysis.sh')

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

  it('routes advisory mode from the workflow to the gate', () => {
    expect(action).toContain('AGENTHOOD_GATE_MODE: ${{ inputs.gate-mode }}')
    expect(analysis).toContain('GATE_MODE="${AGENTHOOD_GATE_MODE:-blocking}"')
    expect(analysis).toContain('"$AGENT_NAME" "$GATE_MODE"')
  })

  it('bounds the diff payload', () => {
    expect(analysis).toContain('bytes > 100000')
    expect(analysis).toContain('(diff truncated at ~100KB)')
    expect(analysis).toContain(':(exclude,glob)**/package-lock.json')
    expect(analysis).toContain('capped at 100 KB')
  })
})
