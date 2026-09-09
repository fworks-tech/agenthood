import { describe, it, expect } from 'vitest'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { loadRituals } from '../../../src/commands/ritual.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function workflowSchedules(content: string): Map<string, { cron: string; member: string }> {
  const schedules = new Map<string, { cron: string; member: string }>()
  for (const line of content.split('\n')) {
    const cron = line.match(/cron: '([^']+)'\s*#\s*([^\s—]+)\s*—\s*(\S+)/)
    if (cron) schedules.set(cron[2], { cron: cron[1], member: cron[3] })
  }
  return schedules
}

describe('rituals workflow parity', () => {
  const manifests = loadRituals(join(root, 'docs', 'rituals'))
  const workflow = readFileSync(join(root, '.github', 'workflows', 'rituals.yml'), 'utf-8')

  it('parses every documented ritual manifest', () => {
    expect(manifests.length).toBeGreaterThanOrEqual(4)
    for (const m of manifests) {
      expect(m.name).toBeTruthy()
      expect(m.member).toBeTruthy()
      expect(m.schedule).toBeTruthy()
      expect(m.description).toBeTruthy()
    }
  })

  it('declares every ritual schedule in the workflow exactly once', () => {
    const schedules = workflowSchedules(workflow)
    expect(schedules.size).toBe(manifests.length)
    for (const m of manifests) {
      expect(schedules.get(m.name)).toEqual({ cron: m.schedule, member: m.member })
    }
  })
})
