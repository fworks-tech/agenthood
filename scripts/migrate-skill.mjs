#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'

const SPEC_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
}

function deriveDescription(body) {
  for (const line of body.split('\n')) {
    const text = line.replace(/^#+\s*/, '').trim()
    if (text.length > 20) return text.slice(0, 200)
  }
  return 'Migrated skill. Use when its instructions apply.'
}

function withTrigger(description) {
  if (/use when/i.test(description)) return description
  return description.replace(/\.$/, '') + '. Use when this task comes up.'
}

function convert(sourceFile, name) {
  const body = readFileSync(sourceFile, 'utf-8').replace(/^\uFEFF/, '').trim()
  const skillName = SPEC_NAME_RE.test(name || '') ? name : slugify(name || basename(sourceFile, '.md'))
  return ['---', 'name: ' + skillName, 'description: ' + withTrigger(deriveDescription(body)), '---', '', body].join('\n') + '\n'
}

const [sourceFile, skillName, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('-'))
if (!sourceFile) {
  console.error('usage: node scripts/migrate-skill.mjs <source-file> [skill-name] [out-dir]')
  process.exit(1)
}
const out = join(outDir || dirname(sourceFile), 'SKILL.md')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, convert(sourceFile, skillName))
console.log('wrote ' + out)
