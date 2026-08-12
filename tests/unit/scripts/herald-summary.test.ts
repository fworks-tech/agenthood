import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { summarize, escapeCell } = require('../../../.github/scripts/herald-summary.cjs')

function mockGithub(runsBySha: Record<string, { total_count: number; workflow_runs: Array<{ name: string; status: string; conclusion: string }> }>) {
  const comments: Array<{ id: number; body: string }> = []
  const created: Array<{ issue_number: number; body: string }> = []
  return {
    comments,
    created,
    client: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: vi.fn(async (args: { head_sha: string }) => ({ data: runsBySha[args.head_sha] })),
        },
        issues: {
          listComments: vi.fn(async () => ({ data: comments })),
          updateComment: vi.fn(async () => {}),
          createComment: vi.fn(async (args: { issue_number: number; body: string }) => {
            created.push(args)
          }),
        },
      },
    },
  }
}

const TRIGGER = ['Society — PR Standards', 'The Envoy — VS Code Extension Build and Test', 'The Reviewer — Commit Review']

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

function runsFor(name: string, conclusion: string) {
  return { name, status: 'completed', conclusion }
}

describe('herald-summary', () => {
  it('counts only the three triggering workflows as trials', async () => {
    const m = mockGithub({
      abc1234: {
        total_count: 5,
        workflow_runs: [
          runsFor('Society — PR Standards', 'success'),
          runsFor('The Reviewer — Commit Review', 'skipped'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'failure'),
          runsFor('Society — PR Labeler', 'success'),
          runsFor('The Herald — CI Summary', 'success'),
        ],
      },
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(1)
    const body = m.created[0].body
    for (const name of TRIGGER) expect(body).toContain(name)
    expect(body).not.toContain('PR Labeler')
    expect(body).toContain('Some trials failed')
  })

  it('treats skipped/neutral/stale as non-failing', async () => {
    const m = mockGithub({
      abc1234: {
        total_count: 3,
        workflow_runs: [
          runsFor('Society — PR Standards', 'success'),
          runsFor('The Reviewer — Commit Review', 'neutral'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'stale'),
        ],
      },
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(1)
    expect(m.created[0].body).toContain('skipped or neutral')
    expect(m.created[0].body).not.toContain('Some trials failed')
  })

  it('summarizes every PR on the workflow run, not just the first', async () => {
    const m = mockGithub({
      abc1234: {
        total_count: 3,
        workflow_runs: [
          runsFor('Society — PR Standards', 'success'),
          runsFor('The Reviewer — Commit Review', 'success'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'success'),
        ],
      },
      def5678: {
        total_count: 3,
        workflow_runs: [
          runsFor('Society — PR Standards', 'success'),
          runsFor('The Reviewer — Commit Review', 'success'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'failure'),
        ],
      },
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }, { number: 2, sha: 'def5678' }]), m.client)
    expect(m.created).toHaveLength(2)
    expect(m.created[0].body).toContain('PR #1')
    expect(m.created[0].body).toContain('cleared for merge')
    expect(m.created[1].body).toContain('PR #2')
    expect(m.created[1].body).toContain('Some trials failed')
  })

  it('escapes markdown table metacharacters in names', () => {
    expect(escapeCell('Evil ](https://evil.example) | `x`')).toBe(
      'Evil \\](https://evil.example) \\| \\`x\\`',
    )
    expect(escapeCell('multi\nline\r\nname')).toBe('multi line name')
    expect(escapeCell('plain')).toBe('plain')
  })

  it('updates the existing verdict comment instead of duplicating', async () => {
    const m = mockGithub({
      abc1234: {
        total_count: 3,
        workflow_runs: [
          runsFor('Society — PR Standards', 'success'),
          runsFor('The Reviewer — Commit Review', 'success'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'success'),
        ],
      },
    })
    m.comments.push({ id: 42, body: "## :x: The Herald's Verdict\nold" })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.client.rest.issues.updateComment).toHaveBeenCalledWith(expect.objectContaining({ comment_id: 42 }))
    expect(m.client.rest.issues.createComment).not.toHaveBeenCalled()
  })

  it('does nothing when no triggering workflow has completed', async () => {
    const m = mockGithub({
      abc1234: {
        total_count: 3,
        workflow_runs: [
          { name: 'Society — PR Standards', status: 'in_progress', conclusion: null },
          runsFor('The Reviewer — Commit Review', 'success'),
          runsFor('The Envoy — VS Code Extension Build and Test', 'success'),
        ],
      },
    })
    await summarize(contextFor([{ number: 1, sha: 'abc1234' }]), m.client)
    expect(m.created).toHaveLength(0)
  })
})
