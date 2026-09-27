#!/usr/bin/env tsx
import { cleanLine } from './generate-release-notes.ts'
import { readFileSync, writeFileSync } from 'node:fs'

const input = process.argv[2] || '-'
const output = process.argv[3] || '-'

const text = input === '-' ? readFileSync(0, 'utf8') : readFileSync(input, 'utf8')
const cleaned = text.split('\n').map(cleanLine).join('\n')
if (output === '-') {
  process.stdout.write(cleaned)
} else {
  writeFileSync(output, cleaned)
}