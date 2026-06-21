#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

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

function cleanLine(line: string): string {
  return line
    .replace(/\s*\(\[`?[0-9a-f]{7,40}`?\]\(https:\/\/[^)]+\)\)/g, '')
    .replace(/,?\s*(closes?|fixes?)\s+\[#\d+\]\(https:\/\/[^)]+\)/gi, '')
    .replace(/\[#(\d+)\]\(https:\/\/[^)]+\)/g, '#$1')
    .replace(/^\*\s+\*\*([^:]+):\*\*\s+/, (_, scope: string) => `- **${scope.charAt(0).toUpperCase() + scope.slice(1)}:** `)
    .replace(/^\* /, '- ')
    .trimEnd()
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
  const rawLines = changelog.split('\n')

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

generate()
