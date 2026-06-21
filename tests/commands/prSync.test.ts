import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Helper tests (pure functions, no mocks needed) ---

describe('prSyncHelpers', () => {
  describe('parseMarker', () => {
    it('returns found=false when no marker present', async () => {
      const { parseMarker } = await import('../../src/commands/prSyncHelpers.js')
      const result = parseMarker('## Why\n\nsome content\n')
      expect(result.found).toBe(false)
      expect(result.sha).toBe('')
      expect(result.before).toBe('## Why\n\nsome content\n')
    })

    it('extracts sha from marker and splits body', async () => {
      const { parseMarker } = await import('../../src/commands/prSyncHelpers.js')
      const body = 'user narrative\n\n<!-- pr-sync: sha=abc123 -->\n\n## What Changed\n\ndetails'
      const result = parseMarker(body)
      expect(result.found).toBe(true)
      expect(result.sha).toBe('abc123')
      expect(result.before).toBe('user narrative\n')
      expect(result.after).toContain('<!-- pr-sync: sha=abc123 -->')
    })

    it('handles body with only marker', async () => {
      const { parseMarker } = await import('../../src/commands/prSyncHelpers.js')
      const result = parseMarker('<!-- pr-sync: sha=abc123 -->')
      expect(result.found).toBe(true)
      expect(result.sha).toBe('abc123')
      expect(result.before).toBe('')
    })
  })

  describe('buildMarker', () => {
    it('produces correct format', async () => {
      const { buildMarker } = await import('../../src/commands/prSyncHelpers.js')
      expect(buildMarker('abc123def456')).toBe('<!-- pr-sync: sha=abc123def456 -->')
    })
  })

  describe('parseRawLog', () => {
    it('parses multiple commits', async () => {
      const { parseRawLog } = await import('../../src/commands/prSyncHelpers.js')
      const raw = `---COMMIT---
abc123
John Doe
john@test.com
2024-01-01 12:00:00 +0000
feat: first commit

body line 1
body line 2
---COMMIT---
def456
Jane Doe
jane@test.com
2024-01-02 14:00:00 +0000
fix: second commit

fix description`

      const commits = parseRawLog(raw)
      expect(commits).toHaveLength(2)
      expect(commits[0].hash).toBe('abc123')
      expect(commits[0].subject).toBe('feat: first commit')
      expect(commits[0].body).toBe('body line 1\nbody line 2')
      expect(commits[0].authorName).toBe('John Doe')
      expect(commits[0].authorEmail).toBe('john@test.com')
      expect(commits[0].date).toBe('2024-01-01 12:00:00 +0000')
      expect(commits[1].hash).toBe('def456')
      expect(commits[1].subject).toBe('fix: second commit')
      expect(commits[1].body).toBe('fix description')
    })

    it('returns empty array for empty input', async () => {
      const { parseRawLog } = await import('../../src/commands/prSyncHelpers.js')
      expect(parseRawLog('')).toEqual([])
      expect(parseRawLog('   ')).toEqual([])
    })

    it('skips malformed blocks', async () => {
      const { parseRawLog } = await import('../../src/commands/prSyncHelpers.js')
      const raw = '---COMMIT---\nonly one line'
      expect(parseRawLog(raw)).toHaveLength(0)
    })
  })

  describe('buildWhatChangedSection', () => {
    it('renders commit list', async () => {
      const { buildWhatChangedSection } = await import('../../src/commands/prSyncHelpers.js')
      const commits = [
        { hash: 'abc123def456', subject: 'feat: add feature', authorName: '', authorEmail: '', date: '', body: '' },
        { hash: '789012aabbcc', subject: 'fix: resolve bug', authorName: '', authorEmail: '', date: '', body: '' },
      ]
      const result = buildWhatChangedSection(commits)
      expect(result).toContain('## What Changed')
      expect(result).toContain('`abc123d` feat: add feature')
      expect(result).toContain('`789012a` fix: resolve bug')
    })

    it('shows placeholder for empty commits', async () => {
      const { buildWhatChangedSection } = await import('../../src/commands/prSyncHelpers.js')
      expect(buildWhatChangedSection([])).toContain('No new commits')
    })
  })

  describe('buildSyncBody', () => {
    it('adds skeleton + auto section for first run', async () => {
      const { buildSyncBody } = await import('../../src/commands/prSyncHelpers.js')
      const commits = [
        { hash: 'abc123', subject: 'feat: first', authorName: '', authorEmail: '', date: '', body: '' },
      ]
      const result = buildSyncBody('', 'sha1234', commits)
      expect(result).toContain('## Why')
      expect(result).toContain('## How to Test')
      expect(result).toContain('<!-- pr-sync: sha=sha1234 -->')
      expect(result).toContain('## What Changed')
    })

    it('replaces auto section on subsequent runs, preserving user narrative', async () => {
      const { buildSyncBody } = await import('../../src/commands/prSyncHelpers.js')
      const existingBody = `My narrative about the PR

<!-- pr-sync: sha=oldsha -->

## What Changed

- \`oldhash\` feat: previous work`

      const commits = [
        { hash: 'newhash', subject: 'feat: new work', authorName: '', authorEmail: '', date: '', body: '' },
      ]
      const result = buildSyncBody(existingBody, 'newsha', commits)
      expect(result).toContain('My narrative about the PR')
      expect(result).not.toContain('oldhash')
      expect(result).not.toContain('oldsha')
      expect(result).toContain('<!-- pr-sync: sha=newsha -->')
      expect(result).toContain('newhash')
    })
  })

  describe('buildReviewerPrompt', () => {
    it('includes commit details', async () => {
      const { buildReviewerPrompt } = await import('../../src/commands/prSyncHelpers.js')
      const commits = [
        { hash: 'abc123', subject: 'feat: add', authorName: '', authorEmail: '', date: '', body: 'details' },
      ]
      const prompt = buildReviewerPrompt(commits)
      expect(prompt).toContain('abc123')
      expect(prompt).toContain('feat: add')
      expect(prompt).toContain('details')
      expect(prompt).toContain('group by type')
    })
  })

  describe('formatPlainComment', () => {
    it('formats commits as markdown list', async () => {
      const { formatPlainComment } = await import('../../src/commands/prSyncHelpers.js')
      const commits = [
        { hash: 'abc123def456', subject: 'feat: awesome', authorName: '', authorEmail: '', date: '', body: '' },
      ]
      const result = formatPlainComment(commits)
      expect(result).toContain('## New Commits')
      expect(result).toContain('`abc123d` feat: awesome')
      expect(result).toContain('agenthood pr-sync')
    })

    it('handles empty commits', async () => {
      const { formatPlainComment } = await import('../../src/commands/prSyncHelpers.js')
      expect(formatPlainComment([])).toBe('No new commits.')
    })
  })
})

// --- Command integration tests (mocked execSync) ---

  describe('prSync command', () => {
    let mockExecSync: any
    let output: string

    beforeEach(async () => {
      output = ''
      vi.spyOn(console, 'log').mockImplementation((...args) => {
        output += args.join(' ') + '\n'
      })
      vi.spyOn(console, 'error').mockImplementation((...args) => {
        output += args.join(' ') + '\n'
      })
      vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit')
      }) as any)

      vi.mock('node:child_process', () => ({
        execSync: vi.fn(),
      }))

      vi.mock('node:fs', () => ({
        writeFileSync: vi.fn(),
        unlinkSync: vi.fn(),
      }))

      const mod = await import('node:child_process')
      mockExecSync = mod.execSync
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

  it('detects PR from --pr flag and syncs body + comment', async () => {
    // Set up execSync responses
    mockExecSync.mockImplementation((cmd: string, _opts?: any) => {
      if (cmd.includes('gh --version')) return 'gh version 2.47.0'
      if (cmd.includes('gh pr view 202 --json baseRefName')) return 'main'
      if (cmd.includes('gh api repos')) return 'existing body'
      if (cmd.includes('git rev-parse HEAD')) return 'currentsha123'
      if (cmd.includes('git merge-base')) return 'basesha123'
      if (cmd.includes('git log')) return '---COMMIT---\nnewsha\nAuthor\na@b.com\n2024-06-01\nfeat: test commit'
      return ''
    })

    const { prSync } = await import('../../src/commands/prSync.js')
    await prSync(['--pr', '202', '--dry-run'])

    expect(output).toContain('[DRY RUN]')
    expect(output).toContain('PR #202')
    expect(output).toContain('1 new commit(s)')
    expect(output).toContain('PROPOSED BODY')
    expect(output).toContain('PROPOSED COMMENT')
  })

  it('exits cleanly when no new commits since last sync', async () => {
    mockExecSync.mockImplementation((cmd: string, _opts?: any) => {
      if (cmd.includes('gh --version')) return 'gh version 2.47.0'
      if (cmd.includes('gh pr view 202 --json baseRefName')) return 'main'
      if (cmd.includes('gh api repos')) return '<!-- pr-sync: sha=currentsha123 -->'
      // Range would be currentsha123..HEAD — mock empty result
      if (cmd.includes('git log')) return ''
      if (cmd.includes('git rev-parse HEAD')) return 'currentsha123'
      return ''
    })

    const { prSync } = await import('../../src/commands/prSync.js')
    await prSync(['--pr', '202', '--dry-run'])

    expect(output).toContain('No new commits since last sync.')
  })

  it('exits with error when gh is not available', async () => {
    mockExecSync.mockImplementation((cmd: string, _opts?: any) => {
      if (cmd.includes('gh --version')) throw new Error('not found')
      return ''
    })

    const { prSync } = await import('../../src/commands/prSync.js')
    await expect(prSync(['--pr', '202'])).rejects.toThrow('process.exit')
    expect(output).toContain('gh CLI not found')
  })

  it('exits with error when PR not found', async () => {
    mockExecSync.mockImplementation((cmd: string, _opts?: any) => {
      if (cmd.includes('gh --version')) return 'gh version 2.47.0'
      if (cmd.includes('git rev-parse --abbrev-ref HEAD')) return 'feature-branch'
      if (cmd.includes('gh pr list --head')) return ''
      return ''
    })

    const { prSync } = await import('../../src/commands/prSync.js')
    await expect(prSync(['--dry-run'])).rejects.toThrow('process.exit')
    expect(output).toContain('No PR detected')
  })
})
