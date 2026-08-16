#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

function findTestFilesForSource(sourceFile) {
  const testFiles = []
  const baseName = basename(sourceFile).replace(/\.tsx?$/, '')
  if (!baseName) return testFiles

  // Search in common test directories
  const testDirs = ['tests/unit', 'tests']
  for (const testDir of testDirs) {
    if (!existsSync(testDir)) continue
    const entries = readdirSync(testDir, { recursive: true })
    for (const entry of entries) {
      if (entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
        const entryFileName = basename(entry)
        const entryBase = entryFileName.replace(/\.(test|spec)\.ts$/, '')
        if (entryBase === baseName || entryBase.startsWith(baseName + '.') || entryBase.endsWith('.' + baseName)) {
          testFiles.push(join(testDir, entry))
        }
      }
    }
  }
  return testFiles
}

function getTestFiles(changedFiles) {
  const testFiles = new Set()

  for (const file of changedFiles) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue

    // Skip test files themselves
    if (file.includes('.test.ts') || file.includes('.spec.ts')) continue

    // Also try direct mapping (src/foo/bar.ts -> tests/unit/foo/bar.test.ts)
    let testFile = file.replace('src/', 'tests/unit/').replace(/\.tsx?$/, '.test.ts')
    if (existsSync(testFile)) {
      testFiles.add(testFile)
      continue
    }

    // Try alternative: tests/foo/bar.test.ts
    testFile = testFile.replace('tests/unit/', 'tests/')
    if (existsSync(testFile)) {
      testFiles.add(testFile)
      continue
    }

    // Fallback: search by base name
    const found = findTestFilesForSource(file)
    for (const f of found) testFiles.add(f)
  }

  return Array.from(testFiles)
}

async function main() {
  const args = process.argv.slice(2)
  const staged = args.includes('--staged')

  const diffCmd = staged ? 'git diff --name-only --staged' : 'git diff --name-only'
  const changedFiles = execSync(diffCmd, { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean)

  const testFiles = getTestFiles(changedFiles)

  if (testFiles.length === 0) {
    console.log(staged ? 'No staged TypeScript files with matching tests' : 'No unstaged TypeScript files with matching tests')
    process.exit(0)
  }

  console.log(`Running tests for: ${testFiles.join(', ')}`)
  execSync(`npx vitest run ${testFiles.join(' ')}`, { stdio: 'inherit' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})