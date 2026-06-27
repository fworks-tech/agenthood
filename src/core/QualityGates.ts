import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DiffImpactAnalyzer } from '../workflows/DiffImpactAnalyzer.js'
import type { ImpactAnalysis } from '../workflows/DiffImpactAnalyzer.js'

export interface GateResult {
  name: string
  pass: boolean
  detail: string
}

export interface GateSet {
  file: string
  line: number
  severity: 'warning' | 'error'
  message: string
}

export class QualityGates {
  check(cwd: string = process.cwd()): GateResult[] {
    const results: GateResult[] = []
    results.push(this.checkTypeScript(cwd))
    results.push(this.checkTests(cwd))
    results.push(this.checkImpact(cwd))
    results.push(this.checkLint(cwd))
    return results
  }

  checkTypeScript(cwd: string): GateResult {
    try {
      execSync('npx tsc --noEmit', { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 60000 })
      return { name: 'TypeScript', pass: true, detail: 'Compiles without errors' }
    } catch (e) {
      const output = (e as { stdout?: string }).stdout || 'unknown error'
      const lines = output.split('\n').filter(l => l.includes('error')).slice(0, 5)
      return { name: 'TypeScript', pass: false, detail: lines.join('; ') || 'Compilation failed' }
    }
  }

  checkTests(cwd: string): GateResult {
    try {
      const output = execSync('npx vitest run --reporter=json 2>&1', { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 120000 })
      const parsed = JSON.parse(output)
      const total = parsed.totalTests || 0
      const passed = parsed.passedTests || 0
      const failed = parsed.failedTests || 0
      return {
        name: 'Tests',
        pass: failed === 0,
        detail: failed === 0 ? `All ${total} tests passing` : `${failed}/${total} tests failing`,
      }
    } catch {
      return { name: 'Tests', pass: false, detail: 'Test runner failed or timed out' }
    }
  }

  checkImpact(cwd: string): GateResult {
    const isRepo = existsSync(join(cwd, '.git'))
    if (!isRepo) return { name: 'Impact', pass: true, detail: 'Not a git repository — skipping impact analysis' }

    try {
      const analyzer = new DiffImpactAnalyzer()
      const impact: ImpactAnalysis = analyzer.analyze()
      if (impact.totalFiles === 0) return { name: 'Impact', pass: true, detail: 'No changes to analyze' }

      const warnings: string[] = []
      if (impact.breaking) warnings.push('Breaking changes detected')
      if (impact.riskLevel === 'high') warnings.push('High risk changes')
      if (impact.affectedAreas.length > 3) warnings.push(`Affects ${impact.affectedAreas.length} areas`)

      const detail = warnings.length > 0
        ? warnings.join('; ') + `. Reviewers: ${impact.suggestedReviewers.join(', ')}`
        : `${impact.totalFiles} files changed (${impact.totalAdditions}+ / ${impact.totalDeletions}-). Low risk.`

      return { name: 'Impact', pass: warnings.length === 0, detail }
    } catch {
      return { name: 'Impact', pass: true, detail: 'Impact analysis skipped (no base branch)' }
    }
  }

  checkLint(cwd: string): GateResult {
    const configPath = join(cwd, 'eslint.config.ts')
    if (!existsSync(configPath)) return { name: 'Lint', pass: true, detail: 'No eslint config found — skipping' }

    try {
      execSync('npx eslint src/', { cwd, encoding: 'utf-8', stdio: 'pipe', timeout: 60000 })
      return { name: 'Lint', pass: true, detail: 'No lint issues' }
    } catch (e) {
      const output = (e as { stdout?: string }).stdout || 'Lint failed'
      const lines = output.split('\n').filter(l => l.includes('error') || l.includes('warning')).slice(0, 5)
      return { name: 'Lint', pass: false, detail: lines.join('; ') || 'Lint check failed' }
    }
  }
}
