import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { summarize, escapeCell, TRIGGER_WORKFLOWS } = require('../../../.github/scripts/herald-summary.cjs')

type Run = { name: string; status: string; conclusion: string | null }
type RunsPage = { total_count: number; workflow_runs: Run[] }

function mockGithub(runsForSha: (sha: string, page: number) => RunsPage, commentsForPage?: (page: number) => Array<{ id: number; body: string; user?: { login: string } }>) {
  const created: Array<{ issue_number: number; body: string }> = []
  return {
    created,
    client: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async (args: { head_sha: string; page: number }) => ({
            data: runsForSha(args.head_sha, args.page),
          })),
        },
        issues: {
          listComments: vi.fn(async (args: { page: number }) => ({
            data: (commentsForPage ? commentsForPage(args.page) : []).map((c) => ({ ...c, user: c.user ?? { login: 'github-actions[bot]' } })),
          })),
          updateComment: vi.fn(async () => {}),
          createComment: vi.fn(async (args: { issue_number: number; body: string }) => {
            created.push(args)
          }),
        },
      },
    },
  }
}

function contextFor(prs: Array<{ number: number; sha: string }>) {
  return {
    payload: {
      workflow_run: {
        pull_requests: prs.map(({ number, sha }) => ({ number, head: { sha } })),
      },
    },
    repo: { owner: 'x', repo: 'y' },
  }
}

function runsFor(name: string, conclusion: string): Run {
  return { name, status: 'completed', conclusion }
}

function completedTriggers(conclusions: Array<[string, string]>): RunsPage {
  return {
    total_count: conclusions.length,
    workflow_runs: conclusions.map(([name, conclusion]) => runsFor(name, conclusion)),
  }
}

describe('herald-summary', () => {
  it('counts only the three triggering workflows as trials', async () => {
    const m = mockGithub(() => completedTriggers([
      ['Society — PR Standards', 'success'],
      ['The Reviewer — Commit Review', 'skipped'],
      ['The Envoy — VS Code Extension Build and Test', 'failure'],
      ['Society — PR Labeler', 'success'],
      ['The Herald — CI Summary', 'success'],
    ]))
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(1)
    const body = m.created[0].body
    for (const name of TRIGGER_WORKFLOWS) expect(body).toContain(name)
    expect(body).not.toContain('PR Labeler')
    expect(body).toContain('Some trials failed')
  })

  it('treats skipped/neutral/stale as non-failing', async () => {
    const m = mockGithub(() => completedTriggers([
      ['Society — PR Standards', 'success'],
      ['The Reviewer — Commit Review', 'neutral'],
      ['The Envoy — VS Code Extension Build and Test', 'stale'],
    ]))
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(1)
    expect(m.created[0].body).toContain('skipped or neutral')
    expect(m.created[0].body).not.toContain('Some trials failed')
  })

  it('summarizes every PR on the workflow run, not just the first', async () => {
    const m = mockGithub((sha) =>
      completedTriggers([
        ['Society — PR Standards', 'success'],
        ['The Reviewer — Commit Review', 'success'],
        ['The Envoy — VS Code Extension Build and Test', sha === 'abc1234' ? 'success' : 'failure'],
      ]),
    )
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }, { number: 2, sha: 'def5678' }]), m.client)
    expect(m.created).toHaveLength(2)
    expect(m.created[0].body).toContain('PR #1')
    expect(m.created[0].body).toContain('cleared for merge')
    expect(m.created[1].body).toContain('PR #2')
    expect(m.created[1].body).toContain('Some trials failed')
  })

  it('collects triggering runs across multiple pages', async () => {
    const m = mockGithub((_sha, page) => {
      // 250 runs: 3 full pages of 100, last page of 50; one trigger per page
      const trigger = page === 1
        ? runsFor('Society — PR Standards', 'success')
        : page === 2
          ? runsFor('The Reviewer — Commit Review', 'success')
          : runsFor('The Envoy — VS Code Extension Build and Test', 'failure')
      const filler = Array.from({ length: 99 }, (_, i) => ({ name: `unrelated-${page}-${i}`, status: 'completed', conclusion: 'success' }))
      return { total_count: 250, workflow_runs: page < 3 ? [trigger, ...filler] : [trigger, ...filler.slice(0, 49)] }
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.client.rest.actions.listWorkflowRunsForRepo).toHaveBeenCalledTimes(3)
    expect(m.created).toHaveLength(1)
    expect(m.created[0].body).toContain('Some trials failed')
    expect(m.created[0].body).toContain('All 3 trials have concluded')
  })

  it('updates the existing verdict comment instead of duplicating', async () => {
    const m = mockGithub(() => completedTriggers([
      ['Society — PR Standards', 'success'],
      ['The Reviewer — Commit Review', 'success'],
      ['The Envoy — VS Code Extension Build and Test', 'success'],
    ]), () => [{ id: 42, body: '## :x: The Herald\'s Verdict\n<!-- agenthood-herald-verdict -->\nold' }])
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.client.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 42 }))
    expect(m.client.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('never overwrites a user comment that mentions the verdict', async () => {
    const m = mockGithub(() => completedTriggers([
      ['Society — PR Standards', 'success'],
      ['The Reviewer — Commit Review', 'success'],
      ['The Envoy — VS Code Extension Build and Test', 'success'],
    ]), () => [{
      id: 42,
      body: "## :x: The Herald's Verdict\nsomeone is wrong about this",
      user: { login: 'some-user' },
    }])
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.client.rest.issues.updateComment).not.toHaveBeenCalled()
    expect(m.client.rest.issues.createComment).toHaveBeenCalledTimes(1)
  })

  it('finds the existing verdict comment across comment pages', async () => {
    // 250 comments: the verdict comment sits on page 3 — a single-page lookup
    // would miss it and create a duplicate
    const m = mockGithub(() => completedTriggers([
      ['Society — PR Standards', 'success'],
      ['The Reviewer — Commit Review', 'success'],
      ['The Envoy — VS Code Extension Build and Test', 'success'],
    ]), (page) => {
      if (page < 3) return Array.from({ length: 100 }, (_, i) => ({ id: page * 1000 + i, body: `comment ${page}-${i}` }))
      if (page === 3) return [{ id: 9999, body: '## :white_check_mark: The Herald\'s Verdict\n<!-- agenthood-herald-verdict -->\nexisting' }, ...Array.from({ length: 49 }, (_, i) => ({ id: 3000 + i, body: `comment 3-${i}` }))]
      return []
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.client.rest.issues.listComments).toHaveBeenCalledTimes(3)
    expect(m.client.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 9999 }))
    expect(m.client.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('waits for all triggering workflows to complete before posting', async () => {
    const m = mockGithub(() => ({
      total_count: 3,
      workflow_runs: [
        { name: 'Society — PR Standards', status: 'in_progress', conclusion: null },
        runsFor('The Reviewer — Commit Review', 'success'),
        runsFor('The Envoy — VS Code Extension Build and Test', 'success'),
      ],
    }))
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(0)
  })

  it('escapes markdown table metacharacters in names', () => {
    expect(escapeCell('Evil ](https://evil.example) | `x` @user <b>')).toBe(
      'Evil \\](https://evil.example) \\| \\`x\\` \\@user \\<b\\>',
    )
    expect(escapeCell('multi\nline\r\nname')).toBe('multi line name')
    expect(escapeCell('plain')).toBe('plain')
  })

  it('keeps TRIGGER_WORKFLOWS in sync with the herald.yml workflow filter', () => {
    const yml = readFileSync(new URL('../../../.github/workflows/herald.yml', import.meta.url), 'utf8')
    const section = yml.match(/workflow_run:\s*\n(?:\s*#.*\n)*\s*workflows:\s*\n([\s\S]*?)\n\s*types:/)?.[1] ?? ''
    expect(section).not.toBe('')
    const ymlWorkflows = [...section.matchAll(/^\s*-\s+('([^']+)'|([^\s].*?))\s*$/gm)].map((m) => m[2] ?? m[3])
    expect(ymlWorkflows.length).toBeGreaterThan(0)
    expect([...TRIGGER_WORKFLOWS].sort()).toEqual(ymlWorkflows.sort())
  })
})
