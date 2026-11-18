import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// These tests match literal YAML and bash strings: they pin the WIRING
// (workflow → action env → script variable), not a behavioral contract.
// Renaming GATE_MODE or a flag breaks them without breaking behavior; the
// behavioral gate and cap coverage lives in tests/scripts/decision-gate.test.sh.
const root = join(import.meta.dirname, '..', '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const workflow = read('.github/workflows/reviewer.yml')
const action = read('.github/actions/agent-analysis/action.yml')
const analysis = read('.github/scripts/agent-analysis.sh')
const gate = read('.github/scripts/decision-gate.sh')

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

  it('bounds the diff payload by bytes, with a truncation marker', () => {
    expect(analysis).toContain('cap_stream_bytes "$TRUNCATED_MARKER"')
    expect(gate).toContain('bytes > 100000')
    expect(gate).toContain('(diff truncated at ~100KB)')
    expect(analysis).toContain(':(exclude,glob)**/package-lock.json')
    expect(analysis).toContain('capped at 100 KB')
  })

  it('discloses omitted files from the first listing, not a second git sweep', () => {
    expect(analysis).toContain('OMITTED_FILES=$(echo "$CHANGED" | grep')
    expect(analysis).not.toContain("git diff --name-only \"${BASE_SHA}...${HEAD_SHA}\" -- ':(glob)**/package-lock.json'")
  })

  it('discloses omitted files before the max-files cut, so the cut never hides an omission', () => {
    const omitted = analysis.indexOf('OMITTED_FILES=$(echo "$CHANGED" | grep')
    const cut = analysis.indexOf('CHANGED=$(echo "$CHANGED" | head')
    expect(omitted).toBeGreaterThan(-1)
    expect(cut).toBeGreaterThan(omitted)
  })

  it('gives the analysis a per-request timeout that fits a full diff', () => {
    // The failover default is 60 s; PR #1089's 28-39 KB reviews exceeded it,
    // retried, then fell through to ollama (absent on a runner).
    expect(analysis).toContain('"requestTimeoutMs": 300000')
  })

  it('states the comment truncation note in bytes only', () => {
    expect(gate).toContain('-byte comment ceiling')
    expect(gate).not.toContain('65536-character')
  })

  it('supersedes the previous skip comment through the shared stale marking', () => {
    const skip = analysis.slice(analysis.indexOf('report_skip() {'), analysis.indexOf('validate_prerequisites() {'))
    expect(skip).toContain('stale_previous_comment')
  })
})
