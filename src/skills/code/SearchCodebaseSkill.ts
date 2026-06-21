import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { ISkill, SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', '.cache'])
const MAX_FILE_SIZE = 512 * 1024 // 512 KB — skip binary/large files
const MAX_RESULTS = 50

function collectMatches(
  dir: string,
  projectRoot: string,
  pattern: RegExp,
  results: string[],
): void {
  if (results.length >= MAX_RESULTS) return

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) return
    if (IGNORED_DIRS.has(entry)) continue

    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      collectMatches(fullPath, projectRoot, pattern, results)
      continue
    }

    const relPath = relative(projectRoot, fullPath)

    // Match against file path
    if (pattern.test(relPath)) {
      results.push(relPath)
      continue
    }

    // Skip large files for content search
    if (stat.size > MAX_FILE_SIZE) continue

    // Match against file content
    try {
      const content = readFileSync(fullPath, 'utf-8')
      if (pattern.test(content)) {
        results.push(relPath)
      }
    } catch {
      // Binary or unreadable file — skip
    }
  }
}

export class SearchCodebaseSkill implements ISkill {
  name = 'search_codebase'
  description = 'Search the codebase for files matching a query (filename or content)'
  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query — plain text or regex pattern' },
    },
    required: ['query'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { query } = input as { query: string }

    if (!query || query.trim() === '') {
      return { success: false, output: '', error: 'query must not be empty' }
    }

    let pattern: RegExp
    try {
      pattern = new RegExp(query, 'i')
    } catch {
      // Invalid regex — treat as literal string
      pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    const results: string[] = []
    collectMatches(context.project.localPath, context.project.localPath, pattern, results)

    if (results.length === 0) {
      return { success: true, output: 'No matches found.' }
    }

    const truncated = results.length >= MAX_RESULTS
    const output = results.join('\n') + (truncated ? `\n\n(results truncated at ${MAX_RESULTS})` : '')
    return { success: true, output }
  }
}
