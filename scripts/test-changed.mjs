#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEST_DIRS = ['tests/unit', 'tests']

// One recursive scan per invocation, indexed by relative directory. The
// leading `unit/` segment is stripped so `tests/unit/rag/...` aligns with
// `src/rag/...` when comparing directories.
export function buildTestIndex() {
  const index = new Map()
  for (const testDir of TEST_DIRS) {
    if (!existsSync(testDir)) continue
    for (const entry of readdirSync(testDir, { recursive: true })) {
      if (!/(\.test|\.spec)\.ts$/.test(entry)) continue
      const relDir = dirname(entry.replace(/\\/g, '/')).replace(/^unit\//, '')
      if (!index.has(relDir)) index.set(relDir, [])
      // forward slashes keep the index comparable to `git diff --name-only` output
      index.get(relDir).push(join(testDir, entry).replace(/\\/g, '/'))
    }
  }
  return index
}

function dirsAreRelated(testRelDir, srcRelDir) {
  return testRelDir === srcRelDir
    || testRelDir.startsWith(srcRelDir + '/')
    || srcRelDir.startsWith(testRelDir + '/')
}

// Match by basename, restricted to test directories that are ancestors or
// descendants of the source's own directory — `src/utils/format.ts` matches
// `tests/unit/utils/format.test.ts` but never `tests/other/format.test.ts`.
export function findTestFilesForSource(sourceFile, index) {
  const baseName = basename(sourceFile).replace(/\.tsx?$/, '')
  if (!baseName) return []
  const srcRelDir = dirname(sourceFile.replace(/\\/g, '/').replace(/^src\//, ''))
  const found = []
  for (const [testRelDir, paths] of index) {
    if (!dirsAreRelated(testRelDir, srcRelDir)) continue
    for (const testPath of paths) {
      const testBase = basename(testPath).replace(/\.(test|spec)\.ts$/, '')
      if (testBase === baseName || testBase.startsWith(baseName + '.') || testBase.endsWith('.' + baseName)) {
        found.push(testPath)
      }
    }
  }
  return found
}

export function getTestFiles(changedFiles, index = buildTestIndex()) {
  const testFiles = new Set()

  for (const file of changedFiles) {
    if (!/\.tsx?$/.test(file)) continue

    // Skip test files themselves
    if (/\.(test|spec)\.ts$/.test(file)) continue

    // Direct mapping (src/foo/bar.ts -> tests/unit/foo/bar.test.ts)
    let testFile = file.replace(/^src\//, 'tests/unit/').replace(/\.tsx?$/, '.test.ts')
    if (existsSync(testFile)) {
      testFiles.add(testFile)
      continue
    }

    // Alternative: tests/foo/bar.test.ts
    testFile = testFile.replace(/^tests\/unit\//, 'tests/')
    if (existsSync(testFile)) {
      testFiles.add(testFile)
      continue
    }

    // Fallback: basename match within related directories
    for (const f of findTestFilesForSource(file, index)) testFiles.add(f)
  }

  return Array.from(testFiles)
}

async function main() {
  const args = process.argv.slice(2)
  const staged = args.includes('--staged')

  const diffCmd = staged ? ['git', 'diff', '--name-only', '--staged'] : ['git', 'diff', '--name-only']
  const diffResult = spawnSync(diffCmd[0], diffCmd.slice(1), { encoding: 'utf-8' })
  const changedFiles = diffResult.stdout.trim().split('\n').filter(Boolean)

  const testFiles = getTestFiles(changedFiles)

  if (testFiles.length === 0) {
    console.log(staged ? 'No staged TypeScript files with matching tests' : 'No unstaged TypeScript files with matching tests')
    process.exit(0)
  }

  console.log(`Running tests for: ${testFiles.join(', ')}`)
  const result = spawnSync('npx', ['vitest', 'run', ...testFiles], { stdio: 'inherit' })
  process.exit(result.status ?? 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
