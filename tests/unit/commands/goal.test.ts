import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { goal, goalChain, FileGoalMemory } from '../../../src/commands/goal.ts'

let cwd: string

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'agenthood-goal-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(cwd, { recursive: true, force: true })
})

describe('goal command', () => {
  it('creates a goal and lists it exactly once', async () => {
    await goal(['create', 'ship auth', '--issue', '#42'], cwd)
    // fresh chain forces the loadGoals path — guards the double-push fix
    const listed: string[] = []
    vi.mocked(console.log).mockImplementation((line: string) => { listed.push(String(line)) })
    await goal(['list'], cwd)
    expect(listed.filter((l) => l.includes('ship auth'))).toHaveLength(1)
    expect(listed[0]).toContain('#42')
  })

  it('runs the subgoal lifecycle to completion', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((line: string) => { logs.push(String(line)) })
    await goal(['create', 'launch'], cwd)
    const id = logs[0]
    await goal(['subgoal', id, 'write notes'], cwd)
    const subId = logs[1]
    await goal(['status', id, subId, 'completed'], cwd)
    await goal(['show', id], cwd)
    expect(logs.some((l) => l.includes('[completed] write notes'))).toBe(true)
  })

  it('next advances the first pending sub-goal', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((line: string) => { logs.push(String(line)) })
    await goal(['create', 'launch'], cwd)
    const id = logs[0]
    await goal(['subgoal', id, 'first'], cwd)
    await goal(['next', id], cwd)
    const chain = goalChain(cwd)
    const sub = (await chain.getGoal(id))?.subGoals[0]
    expect(sub?.status).toBe('in_progress')
  })

  it('next reports when nothing is pending', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((line: string) => { logs.push(String(line)) })
    await goal(['create', 'empty'], cwd)
    await goal(['next', logs[0]], cwd)
    expect(logs[logs.length - 1]).toContain('No pending sub-goals.')
  })
})

describe('FileGoalMemory', () => {
  it('round-trips values across instances', async () => {
    const file = join(cwd, 'goals.json')
    const a = new FileGoalMemory(file)
    await a.store('k', { n: 1 })
    expect(await new FileGoalMemory(file).retrieve('k')).toEqual({ n: 1 })
    expect(await a.retrieve('missing')).toBeNull()
  })

  it('starts empty on corrupt files', async () => {
    const file = join(cwd, 'goals.json')
    writeFileSync(file, 'not json{{{')
    expect(await new FileGoalMemory(file).retrieve('k')).toBeNull()
  })
})
