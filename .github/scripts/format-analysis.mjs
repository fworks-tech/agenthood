#!/usr/bin/env node
// Formats an agent-analysis CLI run into the summary shown in the PR comment and
// posts structured inline findings as GitHub review comments.
//
// The CLI streams each reasoning step as `[step N] model · toks · $cost · <reasoning>`
// and prints the final report as `✔ <member> result:\n<report>`. This script
// keeps only the final report block so a multiline `[step N]` reasoning line
// cannot leak a duplicate copy into the comment (issue #682).
//
// Inline findings: agents emit an `<!--AGENTHOOD_INLINE` block (JSON array of
// {path, line, body}) before their decision marker. The block is stripped from
// the summary and each entry is posted as a line-pinned pull-request review
// comment — the same rendering as a human "+" comment (diff hunk, Reply,
// Resolve). Accuracy is enforced, not trusted: a finding is posted only when
// (path, line) falls inside a new-side hunk span (added or context line) of
// the PR's base...head diff; anything else is dropped with a warning, never
// demoted to a file-level thread (issue #683).
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [, , analysisPath, summaryPath] = process.argv

const telemetryPrefix = '^Error running|^Using |^opencode-go|^groq|^ollama|^All providers|^\\[step |^$'
const INLINE_PATTERN = '<!--AGENTHOOD_INLINE\\s*([\\s\\S]*?)-->'

export function formatSummary(raw) {
  // keep only the final report block; fall back to stripping telemetry noise
  const lines = raw.split('\n')
  const resultIdx = lines.findIndex((l) => /^✔ .* result:/.test(l))
  let summary = ''
  if (resultIdx >= 0) {
    summary = lines.slice(resultIdx + 1).join('\n').replace(/^\n+/, '')
  } else {
    summary = lines.filter((l) => !new RegExp(telemetryPrefix).test(l)).join('\n')
  }
  return summary
}

export function extractInlineFindings(raw) {
  // agents sometimes echo the prompt's empty sample block — take the first
  // block that parses as a non-empty array
  for (const match of raw.matchAll(new RegExp(INLINE_PATTERN, 'g'))) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch { /* try the next block */ }
  }
  return []
}

async function postReviewComments(findings) {
  const { GH_TOKEN, PR_NUMBER, GITHUB_REPOSITORY } = process.env
  if (!GH_TOKEN || !PR_NUMBER || !GITHUB_REPOSITORY) {
    console.warn('[inline] missing env (GH_TOKEN/PR_NUMBER/GITHUB_REPOSITORY) — skipping inline comments')
    return 0
  }
  const range = await resolveDiffRange()
  if (!range) {
    console.warn('[inline] cannot resolve PR diff range — skipping inline comments')
    return 0
  }
  const base = `https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/comments`
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const cache = new Map()
  let posted = 0
  for (const f of findings) {
    if (!f.path || !f.body || typeof f.path !== 'string' || f.path.startsWith('/') || f.path.includes('..') || /[*?[\]()!]/.test(f.path)) continue
    // LLM JSON can carry NaN/float/0/strings — only positive integers pin
    if (!Number.isInteger(f.line) || f.line <= 0) {
      console.warn(`[inline] dropping ${f.path} — no valid line number`)
      continue
    }
    const spans = hunkSpans(f.path, range, cache)
    if (spans === null || !spans.some(([a, b]) => f.line >= a && f.line <= b)) {
      console.warn(`[inline] dropping ${f.path}:${f.line} — not in this diff`)
      continue
    }
    const payload = { commit_id: range.head, path: f.path, line: f.line, side: 'RIGHT', body: f.body }
    const res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (res.ok) {
      posted += 1
    } else {
      console.warn(`[inline] failed to post ${f.path}:${f.line}: ${res.status} ${await res.text()}`)
    }
  }
  return posted
}

// PR base...head SHAs (the same diff GitHub validates pins against), falling
// back to the CI-provided range when the API is unreachable.
async function resolveDiffRange() {
  const { GH_TOKEN, PR_NUMBER, GITHUB_REPOSITORY, BASE_SHA, HEAD_SHA } = process.env
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    })
    if (res.ok) {
      const pr = await res.json()
      if (pr.base?.sha && pr.head?.sha) return { base: pr.base.sha, head: pr.head.sha }
    }
  } catch { /* fall through to env range */ }
  if (BASE_SHA && HEAD_SHA) return { base: BASE_SHA, head: HEAD_SHA }
  return null
}

// New-side hunk spans for a path in base...head (default 3 context lines, so
// context pins land like a human's), cached per path, or null when unreadable.
// The path travels as an argv element (never interpolated) and glob magic is
// rejected above, because it originates from LLM output.
function hunkSpans(path, range, cache) {
  if (cache.has(path)) return cache.get(path)
  let spans = null
  if (/^[0-9a-f]{4,64}$/i.test(range.base) && /^[0-9a-f]{4,64}$/i.test(range.head)) {
    try {
      const diff = execFileSync('git', ['diff', `${range.base}...${range.head}`, '--', path], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      spans = []
      for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const start = Number(m[1])
        const count = m[2] === undefined ? 1 : Number(m[2])
        if (count > 0) spans.push([start, start + count - 1])
      }
    } catch { spans = null }
  }
  cache.set(path, spans)
  return spans
}

const raw = readFileSync(analysisPath, 'utf8')
const findings = extractInlineFindings(raw)
const summary = formatSummary(raw.replace(new RegExp(INLINE_PATTERN, 'g'), ''))
writeFileSync(summaryPath, summary)

if (findings.length > 0) {
  const posted = await postReviewComments(findings)
  if (posted > 0) console.log(`[inline] posted ${posted} inline finding(s)`)
}