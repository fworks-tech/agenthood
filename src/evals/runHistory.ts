import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { EvalRunRecord } from './types.ts'

/**
 * Append-only JSONL history per member. Each eval run appends one JSON line
 * to `.agenthood/evals/history/<member>.jsonl`. No overwrite — history grows
 * until explicitly cleared.
 */
export class RunHistory {
  constructor(
    private readonly member: string,
    private readonly rootDir = join(process.cwd(), '.agenthood', 'evals', 'history'),
  ) {}

  static historyPath(member: string, rootDir?: string): string {
    const dir = rootDir ?? join(process.cwd(), '.agenthood', 'evals', 'history')
    return join(dir, `${member}.jsonl`)
  }

  append(record: EvalRunRecord): void {
    const path = RunHistory.historyPath(this.member, this.rootDir)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' })
  }

  load(): EvalRunRecord[] {
    return this.loadFiltered()
  }

  loadForSuite(suiteName: string): EvalRunRecord[] {
    return this.loadFiltered((r) => r.suiteName === suiteName)
  }

  clear(): void {
    const path = RunHistory.historyPath(this.member, this.rootDir)
    try {
      unlinkSync(path)
    } catch {
      // already gone — nothing to clear
    }
  }

  private loadFiltered(predicate?: (r: EvalRunRecord) => boolean): EvalRunRecord[] {
    const path = RunHistory.historyPath(this.member, this.rootDir)
    let content: string
    try {
      content = readFileSync(path, 'utf8')
    } catch {
      return []
    }
    const records: EvalRunRecord[] = []
    for (const line of content.split('\n')) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as EvalRunRecord
        if (predicate && !predicate(parsed)) continue
        records.push(parsed)
      } catch {
        // skip malformed line
      }
    }
    return records
  }
}
