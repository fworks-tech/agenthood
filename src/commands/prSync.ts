import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseMarker,
  parseRawLog,
  buildSyncBody,
  buildReviewerPrompt,
  formatPlainComment,
} from './prSyncHelpers.ts'
import type { ParsedCommit } from './prSyncHelpers.ts'

interface PRInfo {
  number: number
  baseBranch: string
}

interface PrSyncCliOptions {
  pr?: number
  dryRun?: boolean
  withReviewer?: boolean
}

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim()
}

function ensureGhAvailable(): void {
  try {
    execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' })
  } catch {
    console.error('Error: gh CLI not found. Install from https://cli.github.com/')
    process.exit(1)
  }
}

function parseArgs(args: string[]): PrSyncCliOptions {
  const options: PrSyncCliOptions = { withReviewer: true }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pr': {
        const val = args[++i]
        if (!val || isNaN(parseInt(val, 10))) {
          console.error('Error: --pr requires a numeric argument')
          process.exit(1)
        }
        options.pr = parseInt(val, 10)
        break
      }
      case '--dry-run':
        options.dryRun = true
        break
      case '--no-reviewer':
        options.withReviewer = false
        break
    }
  }

  return options
}

function detectPR(options: PrSyncCliOptions): PRInfo | null {
  let prNumber: number | null = options.pr ?? null

  if (!prNumber) {
    const envVal = process.env.GH_PR_NUMBER
    if (envVal) {
      prNumber = parseInt(envVal, 10)
      if (isNaN(prNumber)) prNumber = null
    }
  }

  if (prNumber) {
    try {
      const baseBranch = run(`gh pr view ${prNumber} --json baseRefName --jq '.baseRefName'`)
      return { number: prNumber, baseBranch }
    } catch {
      console.error(`Error: PR #${prNumber} not found`)
      process.exit(1)
    }
  }

  try {
    const branch = run('git rev-parse --abbrev-ref HEAD')
    if (branch === 'main') return null
    const result = run(`gh pr list --head "${branch}" --json number,baseRefName --jq '.[0]'`)
    if (result && result !== 'null' && result !== '') {
      const parsed = JSON.parse(result)
      return { number: parsed.number, baseBranch: parsed.baseRefName }
    }
  } catch {
    // No open PR for this branch
  }

  return null
}

function getCommitsSince(sinceSha: string | null, baseBranch: string): ParsedCommit[] {
  let range: string
  if (sinceSha) {
    range = `${sinceSha}..HEAD`
  } else {
    try {
      const mergeBase = run(`git merge-base HEAD origin/${baseBranch}`)
      range = `${mergeBase}..HEAD`
    } catch {
      const root = run('git rev-list --max-parents=0 HEAD')
      range = `${root}..HEAD`
    }
  }

  const raw = run(`git log ${range} --format="---COMMIT---%n%H%n%an%n%ae%n%ai%n%s%n%b" --reverse`)
  return parseRawLog(raw)
}

function ghApiPatch(path: string, data: object): void {
  const tmpFile = join(tmpdir(), `agenthood-gh-${Date.now()}.json`)
  try {
    writeFileSync(tmpFile, JSON.stringify(data))
    run(`gh api -X PATCH ${path} --input "${tmpFile}"`)
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

function ghApiPost(path: string, data: object): void {
  const tmpFile = join(tmpdir(), `agenthood-gh-${Date.now()}.json`)
  try {
    writeFileSync(tmpFile, JSON.stringify(data))
    run(`gh api -X POST ${path} --input "${tmpFile}"`)
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

async function generateLLMComment(commits: ParsedCommit[]): Promise<string> {
  try {
    const { LLMRouter } = await import('../llm/LLMRouter.ts')
    const llm = LLMRouter.create({})
    const prompt = buildReviewerPrompt(commits)
    const result = await llm.complete({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1024,
      temperature: 0.1,
    })
    return result.content
  } catch {
    return formatPlainComment(commits)
  }
}

export async function prSync(args: string[]): Promise<void> {
  ensureGhAvailable()

  const options = parseArgs(args)
  const prInfo = detectPR(options)

  if (!prInfo) {
    console.log('No open PR detected for this branch. Skipping sync.')
    return
  }

  try {
    // Fetch current PR body
    const currentBody = run(`gh api repos/{owner}/{repo}/pulls/${prInfo.number} --jq '.body // ""'`)

    // Find existing marker to determine since-sha
    const { sha: lastSyncSha } = parseMarker(currentBody)
    const commits = getCommitsSince(lastSyncSha || null, prInfo.baseBranch)

    if (commits.length === 0) {
      console.log('No new commits since last sync.')
      return
    }

    const currentSha = run('git rev-parse HEAD')

    // Build new PR body
    const newBody = buildSyncBody(currentBody, currentSha, commits)

    if (options.dryRun) {
      console.log(`[DRY RUN] PR #${prInfo.number} — ${commits.length} new commit(s) since ${lastSyncSha || 'base'}`)
      console.log('\n=== PROPOSED BODY ===')
      console.log(newBody)
    } else {
      ghApiPatch(`repos/{owner}/{repo}/pulls/${prInfo.number}`, { body: newBody })
    }

    // Generate and post comment
    const hasApiKey = !!(process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
    const shouldUseReviewer = options.withReviewer !== false && hasApiKey

    let comment: string
    if (shouldUseReviewer) {
      comment = await generateLLMComment(commits)
    } else {
      comment = formatPlainComment(commits)
    }

    if (options.dryRun) {
      console.log('\n=== PROPOSED COMMENT ===')
      console.log(comment)
      console.log(`\n[Dry run complete. No changes made.]`)
    } else {
      ghApiPost(`repos/{owner}/{repo}/issues/${prInfo.number}/comments`, { body: comment })
      console.log(`PR #${prInfo.number} synced (${commits.length} new commit(s)).`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`PR sync failed: ${msg}`)
    process.exit(1)
  }
}
