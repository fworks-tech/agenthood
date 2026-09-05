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
// {path, line?, body}) before their decision marker. The block is stripped from
// the summary and each entry is posted as a pull-request review comment.
// Accuracy is enforced, not trusted: a line comment is posted only when
// (path, line) is an added line in the base...head diff; anything else is
// dropped with a warning (issue #683).
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [, , analysisPath, summaryPath] = process.argv

const telemetryPrefix = '^Error running|^Using |^opencode-go|^groq|^ollama|^All providers|^\\[step |^$'
const INLINE_BLOCK = /<!--AGENTHOOD_INLINE\s*([\s\S]*?)-->/

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
  const match = raw.match(INLINE_BLOCK)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    console.warn('[inline] unparseable AGENTHOOD_INLINE block')
    return []
  }
}

async function postReviewComments(findings) {
  const { GH_TOKEN, PR_NUMBER, HEAD_SHA, BASE_SHA, GITHUB_REPOSITORY } = process.env
  if (!GH_TOKEN || !PR_NUMBER || !HEAD_SHA || !BASE_SHA || !GITHUB_REPOSITORY) {
    console.warn('[inline] missing env (GH_TOKEN/PR_NUMBER/HEAD_SHA/BASE_SHA/GITHUB_REPOSITORY) — skipping inline comments')
    return 0
  }
  const base = `https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/comments`
  const headers = {
    Authorization: `Bearer ${GH_TOKEN}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  let posted = 0
  for (const f of findings) {
    if (!f.path || !f.body || typeof f.path !== 'string' || f.path.startsWith('/') || f.path.includes('..')) continue
    const ranges = addedLineRanges(f.path, BASE_SHA, HEAD_SHA)
    if (ranges === null) {
      console.warn(`[inline] dropping ${f.path} — cannot validate against the diff`)
      continue
    }
    if (typeof f.line === 'number') {
      const pinned = ranges.some(([a, b]) => f.line >= a && f.line <= b)
      if (!pinned) {
        console.warn(`[inline] dropping ${f.path}:${f.line} — not an added line in this diff`)
        continue
      }
    } else if (ranges.length === 0) {
      console.warn(`[inline] dropping ${f.path} — file not in this diff`)
      continue
    }
    const payload = { commit_id: HEAD_SHA, path: f.path, body: f.body, subject_type: 'line' }
    if (typeof f.line === 'number') payload.line = f.line
    let res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok && payload.subject_type === 'line') {
      // diff moved under us (new push) → retry as a file-level comment
      delete payload.line
      payload.subject_type = 'file'
      res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(payload) })
    }
    if (res.ok) {
      posted += 1
    } else {
      console.warn(`[inline] failed to post ${f.path}${f.line ? `:${f.line}` : ''}: ${res.status} ${await res.text()}`)
    }
  }
  return posted
}

// Added-line ranges for a path in base...head, or null when the diff cannot
// be read. The path is passed as an argv element (never interpolated) because
// it originates from LLM output.
function addedLineRanges(path, baseSha, headSha) {
  if (!/^[0-9a-f]{4,64}$/i.test(baseSha) || !/^[0-9a-f]{4,64}$/i.test(headSha)) return null
  try {
    const diff = execFileSync('git', ['diff', '--unified=0', `${baseSha}...${headSha}`, '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const ranges = []
    for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
      const start = Number(m[1])
      const count = m[2] === undefined ? 1 : Number(m[2])
      if (count > 0) ranges.push([start, start + count - 1])
    }
    return ranges
  } catch {
    return null
  }
}

const raw = readFileSync(analysisPath, 'utf8')
const findings = extractInlineFindings(raw)
const summary = formatSummary(raw.replace(INLINE_BLOCK, ''))
writeFileSync(summaryPath, summary)

if (findings.length > 0) {
  const posted = await postReviewComments(findings)
  if (posted > 0) console.log(`[inline] posted ${posted} inline finding(s)`)
}