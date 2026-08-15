import { execFileSync } from 'node:child_process'
import type { CommandDescriptor } from './types.ts'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
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

/** execFileSync variant for git/gh invocations — args are passed as array
 * elements, never through a shell, so attacker-influenced values (PR body
 * markers, branch names, baseRefName) cannot inject commands */
function runFile(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe' }).trim()
}

function ensureGhAvailable(): void {
  try {
    runFile('gh', ['--version'])
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
        if (!val || !/^\d+$/.test(val)) {
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
      const baseBranch = runFile('gh', ['pr', 'view', String(prNumber), '--json', 'baseRefName', '--jq', '.baseRefName'])
      return { number: prNumber, baseBranch }
    } catch {
      console.error(`Error: PR #${prNumber} not found`)
      process.exit(1)
    }
  }

  try {
    const branch = runFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    if (branch === 'main') return null
    const result = runFile('gh', ['pr', 'list', '--head', branch, '--json', 'number,baseRefName', '--jq', '.[0]'])
    if (result && result !== 'null' && result !== '') {
      const parsed = JSON.parse(result)
      return { number: parsed.number, baseBranch: parsed.baseRefName }
    }
  } catch {
    // No open PR for this branch
  }

  return null
}

const LOCK_SUFFIX_RE = /\.lock$/i

/** Builds the remote ref for a base branch. The `origin/` prefix is a safety
 * invariant: it guarantees the ref is never parsed as a git option even when
 * the branch name itself starts with `-`. Keep all git *ref* usages (merge
 * base, ranges) behind this helper so the invariant cannot silently regress.
 * gh invocations that take a bare branch name (e.g. `gh pr list --head`) do
 * not use it — gh has no ref-vs-option ambiguity for positional/flag values. */
function originRef(baseBranch: string): string {
  return `origin/${baseBranch}`
}

/** Mirrors git check-ref-format: refnames are untrusted input, and a
 * malformed one would either compute a wrong range or break rev-parse.
 *
 * Empirical references (git 2.55.0.windows.3, `git check-ref-format <ref>`):
 *   - `foo./bar` → valid (only the whole ref may not end with a dot)
 *   - `feature/-lead` → valid (leading dashes are legal components)
 *   - `foo.lock`, `foo.Lock` → invalid on this git build. The man page only
 *     documents ".lock", so the case-insensitive match here is intentional,
 *     fail-closed strictness rather than a documented git rule.
 *
 * We intentionally do NOT require a slash — GitHub allows onelevel branches
 * like `main`. Leading dashes are safe because refs are always passed through
 * originRef() (never parsed as a flag).
 */
export function isValidRefname(name: string): boolean {
  if (!name || name.length === 0) return false
  if (!/^[A-Za-z0-9._/@-]+$/.test(name)) return false
  if (name === '@') return false
  if (name.startsWith('/') || name.endsWith('/')) return false
  if (name.includes('..') || name.includes('//') || name.includes('@{')) return false
  if (name.endsWith('.')) return false
  const components = name.split('/')
  if (components.some((c) => c.startsWith('.'))) return false
  // fail-closed: reject any component ending in .lock, case-insensitively
  if (components.some((c) => LOCK_SUFFIX_RE.test(c))) return false
  return true
}

function getCommitsSince(sinceSha: string | null, baseBranch: string): ParsedCommit[] {
  // PR body markers are attacker-editable — never let a non-SHA reach the shell
  if (sinceSha && !/^[0-9a-f]{40}$/i.test(sinceSha)) {
    console.warn(`Malformed sync marker SHA ignored: ${sinceSha}`)
    sinceSha = null
  }
  // baseRefName is GitHub-sourced; array args prevent injection, but a
  // malformed refname must fail loudly instead of computing a wrong range
  if (!isValidRefname(baseBranch)) {
    console.error(`PR sync failed: invalid base branch refname: ${JSON.stringify(baseBranch)}`)
    process.exit(1)
  }

  let range: string | null = null
  if (sinceSha) {
    try {
      runFile('git', ['merge-base', '--is-ancestor', sinceSha, 'HEAD'])
      range = `${sinceSha}..HEAD`
    } catch {
      sinceSha = null
    }
  }
  if (!sinceSha) {
    try {
      const mergeBase = runFile('git', ['merge-base', 'HEAD', originRef(baseBranch)])
      range = `${mergeBase}..HEAD`
    } catch {
      const root = runFile('git', ['rev-list', '--max-parents=0', 'HEAD'])
      range = `${root}..HEAD`
    }
  }

  const raw = runFile('git', ['log', range ?? 'HEAD', '--format=---COMMIT---%n%H%n%an%n%ae%n%ai%n%s%n%b', '--reverse'])
  return parseRawLog(raw)
}

/** Write JSON to a private temp file inside a fresh dir; returns its path */
function writePrivateTempJson(data: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'agenthood-'))
  const file = join(dir, 'payload.json')
  writeFileSync(file, JSON.stringify(data), { mode: 0o600 })
  return file
}

function removeTempJson(file: string): void {
  try { rmSync(dirname(file), { recursive: true, force: true }) } catch { /* ignore */ }
}

function ghApiPatch(path: string, data: object): void {
  const tmpFile = writePrivateTempJson(data)
  try {
    runFile('gh', ['api', '-X', 'PATCH', path, '--input', tmpFile])
  } finally {
    removeTempJson(tmpFile)
  }
}

function ghApiPost(path: string, data: object): void {
  const tmpFile = writePrivateTempJson(data)
  try {
    runFile('gh', ['api', '-X', 'POST', path, '--input', tmpFile])
  } finally {
    removeTempJson(tmpFile)
  }
}

async function generateLLMComment(commits: ParsedCommit[]): Promise<string> {
  try {
    const { LLMRouter } = await import('../llm/LLMRouter.ts')
    const llm = await LLMRouter.create({})
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

export const command: CommandDescriptor = {
  name: 'pr-sync',
  description: 'Sync PR body and post comment for new commits',
  handler: (args) => prSync(args),
}

interface SyncPayload {
  lastSyncSha: string
  commits: ParsedCommit[]
  newBody: string
}

function buildSyncPayload(currentBody: string, prInfo: PRInfo): SyncPayload | null {
  const { sha: lastSyncSha } = parseMarker(currentBody)
  const commits = getCommitsSince(lastSyncSha || null, prInfo.baseBranch)
  if (commits.length === 0) {
    console.log('No new commits since last sync.')
    return null
  }
  const parents = runFile('git', ['rev-list', '--parents', 'HEAD', '-1']).split(' ')
  const currentSha = parents.length > 2 ? parents[1] : parents[0]
  return { lastSyncSha, commits, newBody: buildSyncBody(currentBody, currentSha, commits) }
}

function postComment(prNumber: number, comment: string, dryRun: boolean): void {
  if (dryRun) {
    console.log('\n=== PROPOSED COMMENT ===')
    console.log(comment)
    console.log(`\n[Dry run complete. No changes made.]`)
  } else {
    ghApiPost(`repos/{owner}/{repo}/issues/${prNumber}/comments`, { body: comment })
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
    const currentBody = runFile('gh', ['api', `repos/{owner}/{repo}/pulls/${prInfo.number}`, '--jq', '.body // ""'])

    const payload = buildSyncPayload(currentBody, prInfo)
    if (!payload) return
    const { lastSyncSha, commits, newBody } = payload

    if (options.dryRun) {
      console.log(`[DRY RUN] PR #${prInfo.number} — ${commits.length} new commit(s) since ${lastSyncSha || 'base'}`)
      console.log('\n=== PROPOSED BODY ===')
      console.log(newBody)
    } else {
      ghApiPatch(`repos/{owner}/{repo}/pulls/${prInfo.number}`, { body: newBody })
    }

    // Reviewer comment (opt-out via --no-reviewer) or plain list
    const hasApiKey = !!(process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
    const comment = options.withReviewer !== false && hasApiKey
      ? await generateLLMComment(commits)
      : formatPlainComment(commits)

    postComment(prInfo.number, comment, options.dryRun === true)
    if (!options.dryRun) {
      console.log(`PR #${prInfo.number} synced (${commits.length} new commit(s)).`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`PR sync failed: ${msg}`)
    process.exit(1)
  }
}
