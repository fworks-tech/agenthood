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
// {path, line?, body}) after their decision marker. The block is stripped from
// the summary and each entry is posted as a pull-request review comment
// (subject_type line, falling back to file-level) (issue #683).
import { readFileSync, writeFileSync } from 'node:fs'

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
  const { GH_TOKEN, PR_NUMBER, HEAD_SHA, GITHUB_REPOSITORY } = process.env
  if (!GH_TOKEN || !PR_NUMBER || !HEAD_SHA || !GITHUB_REPOSITORY) {
    console.warn('[inline] missing env (GH_TOKEN/PR_NUMBER/HEAD_SHA/GITHUB_REPOSITORY) — skipping inline comments')
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
    if (!f.path || !f.body) continue
    const payload = { commit_id: HEAD_SHA, path: f.path, body: f.body, subject_type: 'line' }
    if (typeof f.line === 'number') payload.line = f.line
    let res = await fetch(base, { method: 'POST', headers, body: JSON.stringify(payload) })
    if (!res.ok && payload.subject_type === 'line') {
      // line not part of the diff → retry as a file-level comment
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

const raw = readFileSync(analysisPath, 'utf8')
const findings = extractInlineFindings(raw)
const summary = formatSummary(raw.replace(INLINE_BLOCK, ''))
writeFileSync(summaryPath, summary)

if (findings.length > 0) {
  const posted = await postReviewComments(findings)
  if (posted > 0) console.log(`[inline] posted ${posted} inline finding(s)`)
}