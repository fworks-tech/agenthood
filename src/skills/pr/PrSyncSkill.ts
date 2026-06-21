import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ISkill } from '../ISkill.ts'
import type { SkillResult } from '../ISkill.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import {
  parseMarker,
  parseRawLog,
  buildSyncBody,
  buildReviewerPrompt,
  formatPlainComment,
} from '../../commands/prSyncHelpers.ts'

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim()
}

export class PrSyncSkill implements ISkill {
  name = 'pr_sync'
  description = 'Sync a GitHub pull request body with new commits and post a reviewer comment. Detects new commits since the last sync marker, updates the PR description, and generates a summary comment.'
  inputSchema = {
    type: 'object',
    properties: {
      prNumber: { type: 'number', description: 'Pull request number to sync' },
      dryRun: { type: 'boolean', description: 'Preview changes without making any API calls' },
    },
    required: ['prNumber'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { prNumber, dryRun } = input as { prNumber: number; dryRun?: boolean }

    try {
      execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' })
    } catch {
      return { success: false, output: '', error: 'gh CLI not found at https://cli.github.com/' }
    }

    try {
      // Get base branch for merge-base calculation
      let baseBranch: string
      try {
        baseBranch = execSync(
          `gh pr view ${prNumber} --json baseRefName --jq '.baseRefName'`,
          { encoding: 'utf-8', stdio: 'pipe' },
        ).trim()
      } catch {
        return { success: false, output: '', error: `PR #${prNumber} not found` }
      }

      // Fetch current PR body
      const currentBody = execSync(
        `gh api repos/{owner}/{repo}/pulls/${prNumber} --jq '.body // ""'`,
        { encoding: 'utf-8', stdio: 'pipe' },
      ).trim()

      // Find existing marker to determine since-sha
      const { sha: lastSyncSha } = parseMarker(currentBody)

      // Get new commits since last sync
      let range: string
      if (lastSyncSha) {
        range = `${lastSyncSha}..HEAD`
      } else {
        try {
          const mergeBase = execSync(
            `git merge-base HEAD origin/${baseBranch}`,
            { encoding: 'utf-8', stdio: 'pipe' },
          ).trim()
          range = `${mergeBase}..HEAD`
        } catch {
          const root = execSync(
            'git rev-list --max-parents=0 HEAD',
            { encoding: 'utf-8', stdio: 'pipe' },
          ).trim()
          range = `${root}..HEAD`
        }
      }

      const rawLog = execSync(
        `git log ${range} --format="---COMMIT---%n%H%n%an%n%ae%n%ai%n%s%n%b" --reverse`,
        { encoding: 'utf-8', stdio: 'pipe' },
      ).trim()

      const commits = parseRawLog(rawLog)

      if (commits.length === 0) {
        return { success: true, output: 'No new commits since last sync.' }
      }

      const currentSha = execSync(
        'git rev-parse HEAD',
        { encoding: 'utf-8', stdio: 'pipe' },
      ).trim()

      // Build new PR body
      const newBody = buildSyncBody(currentBody, currentSha, commits)

      if (!dryRun) {
        // Update PR body via temp file
        const bodyFile = join(tmpdir(), `agenthood-pr-sync-body-${prNumber}.json`)
        try {
          writeFileSync(bodyFile, JSON.stringify({ body: newBody }))
          execSync(
            `gh api -X PATCH repos/{owner}/{repo}/pulls/${prNumber} --input "${bodyFile}"`,
            { encoding: 'utf-8', stdio: 'pipe' },
          )
        } finally {
          try { unlinkSync(bodyFile) } catch { /* ignore */ }
        }

        // Generate and post comment
        const hasApiKey = !!(process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
        let comment: string

        if (hasApiKey) {
          try {
            const { LLMRouter } = await import('../../llm/LLMRouter.ts')
            const llm = LLMRouter.create({})
            const prompt = buildReviewerPrompt(commits)
            const result = await llm.complete({
              messages: [{ role: 'user', content: prompt }],
              maxTokens: 1024,
              temperature: 0.1,
            })
            comment = result.content
          } catch {
            comment = formatPlainComment(commits)
          }
        } else {
          comment = formatPlainComment(commits)
        }

        const commentFile = join(tmpdir(), `agenthood-pr-sync-comment-${prNumber}.json`)
        try {
          writeFileSync(commentFile, JSON.stringify({ body: comment }))
          execSync(
            `gh api -X POST repos/{owner}/{repo}/issues/${prNumber}/comments --input "${commentFile}"`,
            { encoding: 'utf-8', stdio: 'pipe' },
          )
        } finally {
          try { unlinkSync(commentFile) } catch { /* ignore */ }
        }
      }

      const result = `PR #${prNumber} synced (${commits.length} new commit(s)).\n\n---\n${newBody}`
      return { success: true, output: result }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `PR sync failed: ${msg}` }
    }
  }
}
