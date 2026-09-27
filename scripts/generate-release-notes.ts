#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHANGELOG = 'CHANGELOG.md'
const OUTPUT = 'docs/release-notes.md'

const SECTION_EMOJI: Record<string, string> = {
  'Features': '✨',
  'Bug Fixes': '🐛',
  'Documentation': '📝',
  'Performance Improvements': '⚡',
  'Reverts': '⏪',
  'Code Refactoring': '🔧',
  'Tests': '🧪',
  'Build System': '📦',
  'Continuous Integration': '⚙️',
  'Chores': '🔩',
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * conventional-changelog appends the parsed issue references as
 * 'closes [#1](url) [#2](url) ...' — one keyword, then every #N it found
 * anywhere in the commit body. The parser gives a bare '#900' mentioned in
 * prose the same 'close' action as a real 'Closes #900', so this list mixes
 * genuine closures with mentions and repeats whatever was cited twice.
 *
 * Keep the numbers, drop the claim: the ids are informative, the 'closes'
 * verb is not, and GitHub's tracker remains the source of truth for what
 * is actually closed. Consuming the whole list also avoids a bare '#1' or
 * '#2' leaking into the rendered line, which is what the previous
 * single-link regex did for every reference after the first.
 *
 * Links inside the group are separated by whitespace, but the separator after
 * the last one is left alone. Consuming it glues the replacement against the
 * text that follows, which is how a rendered line became
 * '#945[#N](https://.../issues/N)'; dropping the separator allowance entirely
 * stops the group after one link, which left a second invented ref behind.
 *
 * The group accepts any label containing a '#', not just one starting with
 * it. The linkifier also mangles plain prose into labels like
 * '[hi#severity](https://github.com/hi/issues/severity)' out of the words
 * 'high-severity', which would otherwise survive as a closing claim for an
 * issue nobody closed. Invented refs are consumed along with the real ones,
 * and a keyword whose whole list yields no local id goes too rather than
 * rendering as a bare 'closes'.
 */
function cleanRefs(line: string): string {
  return line.replace(
    /,?\s*(?:closes?|fixes?)\s+((?:\[[^\]]*#[^\]]*\]\([^)]+\)(?:\s+|(?=$)))+)/gi,
    (_, refs: string) => {
      const ids = [...refs.matchAll(/#(\d+)/g)].map(m => `#${m[1]}`)
      return ids.length > 0 ? `, refs ${[...new Set(ids)].join(', ')}` : ''
    }
  )
}

/**
 * conventional-changelog linkifies every '#N' mentioned anywhere in a commit
 * body, so the refs list is followed by a trail of links for prose mentions —
 * mostly duplicates of ids already listed. Fold the whole tail into one
 * deduped list so the dedup reaches the end of the line.
 */
function mergeRefs(line: string): string {
  const at = line.indexOf(', refs ')
  if (at === -1) return line
  const ids = [...line.slice(at).matchAll(/#(\d+)/g)].map(m => `#${m[1]}`)
  return `${line.slice(0, at)}, refs ${[...new Set(ids)].join(', ')}`
}

/**
 * A commit body that quotes link syntax makes the linkifier invent refs like
 * '[#N](https://.../issues/N)' and '[#pages](.../issues/pages)'. No such
 * issues exist, so drop the link rather than publish a raw URL or an
 * unresolvable '#N'. Invented refs also appear with no closing keyword beside
 * them, so this runs on its own and not only inside the closes list.
 */
function dropInventedRefs(line: string): string {
  return line.replace(/\[#[^\]\d][^\]]*\]\([^)]+\)/g, '')
}

export function cleanLine(line: string): string {
  const cleaned = dropInventedRefs(cleanRefs(line))
    .replace(/\s*\(\[`?[0-9a-f]{7,40}`?\]\(https:\/\/[^)]+\)\)/g, '')
    .replace(/\[#(\d+)\]\(https:\/\/[^)]+\)/g, '#$1')
    .replace(/^\*\s+\*\*([^:]+):\*\*\s+/, (_, scope: string) => `- **${scope.charAt(0).toUpperCase() + scope.slice(1)}:** `)
    .replace(/^\* /, '- ')
    .trimEnd()
  return mergeRefs(cleaned)
}

function transformBlock(versionLine: string, bodyLines: string[]): string | null {
  const versionMatch = versionLine.match(/^#{1,2}\s+\[?([\d.]+)\]?(?:\([^)]+\))?\s+\((\d{4}-\d{2}-\d{2})\)/)
  if (!versionMatch) return null

  const version = versionMatch[1]
  const date = formatDate(versionMatch[2])

  const sections: Record<string, string[]> = {}
  let currentSection: string | null = null

  for (const line of bodyLines) {
    const sectionMatch = line.match(/^###\s+(.+)/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      sections[currentSection] = []
      continue
    }
    if (currentSection && line.match(/^\* /)) {
      const cleaned = cleanLine(line)
      if (cleaned) sections[currentSection].push(cleaned)
    }
  }

  const lines: string[] = [`## v${version} — ${date}`, '']

  for (const [section, items] of Object.entries(sections)) {
    if (items.length === 0) continue
    const emoji = SECTION_EMOJI[section] ?? '🔹'
    lines.push(`### ${emoji} ${section}`, '')
    lines.push(...items)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

function generate(): void {
  const changelog = readFileSync(CHANGELOG, 'utf8')

  // conventional-changelog is the source of the 'closes' list, and it marks
  // every bare '#N' in a commit body as a closure. Normalise it here, on the
  // way out, so the committed changelog cannot claim an issue was closed when
  // the commit only mentioned it — that is how 'closes #900' shipped for a
  // migration that is still open. Only the refs are touched: the changelog
  // keeps conventional-changelog's own bullet and commit-link format, which
  // cleanLine rewrites for the rendered notes.
  const normalised = changelog
    .split('\n')
    .map(line => mergeRefs(dropInventedRefs(cleanRefs(line))).trimEnd())
    .join('\n')
  if (normalised !== changelog) writeFileSync(CHANGELOG, normalised, 'utf8')

  const rawLines = normalised.split('\n')

  const blocks: Array<{ header: string; body: string[] }> = []
  let currentHeader: string | null = null
  let currentBody: string[] = []

  for (const line of rawLines) {
    if (line.match(/^#{1,2}\s+\[?[\d.]+\]?/)) {
      if (currentHeader) blocks.push({ header: currentHeader, body: currentBody })
      currentHeader = line
      currentBody = []
    } else if (currentHeader) {
      currentBody.push(line)
    }
  }
  if (currentHeader) blocks.push({ header: currentHeader, body: currentBody })

  const transformed = blocks
    .map(b => transformBlock(b.header, b.body))
    .filter(Boolean)
    .join('\n\n---\n\n')

  const output = [
    '# 📦 Release Notes',
    '',
    '> Full version history for [Agenthood](https://github.com/fworks-tech/agenthood).',
    '> Generated automatically — do not edit manually.',
    '',
    '---',
    '',
    transformed,
    '',
  ].join('\n')

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, output, 'utf8')
  console.log(`✅ Generated ${OUTPUT} (${blocks.length} releases)`)
}

/** Guard that returns true only when this module is executed directly (not imported for tests). */
function isMain(): boolean {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')
  } catch {
    return false
  }
}

if (isMain()) generate()
