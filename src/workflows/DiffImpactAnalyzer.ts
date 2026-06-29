import { execSync } from 'node:child_process'

export interface DiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
}

export interface ImpactAnalysis {
  files: DiffFile[]
  totalAdditions: number
  totalDeletions: number
  totalFiles: number
  affectedAreas: string[]
  riskLevel: 'low' | 'medium' | 'high'
  suggestedReviewers: string[]
  breaking: boolean
}

const AREA_PATTERNS: { pattern: RegExp; area: string }[] = [
  { pattern: /^src\/commands\//, area: 'cli' },
  { pattern: /^src\/workflows\//, area: 'workflows' },
  { pattern: /^src\/agents\//, area: 'agents' },
  { pattern: /^src\/memory\//, area: 'memory' },
  { pattern: /^src\/rag\//, area: 'rag' },
  { pattern: /^src\/llm\//, area: 'llm' },
  { pattern: /^src\/skills\//, area: 'skills' },
  { pattern: /^src\/reasoning\//, area: 'reasoning' },
  { pattern: /^src\/core\//, area: 'core' },
  { pattern: /^src\/members\//, area: 'members' },
  { pattern: /^members\//, area: 'skill-files' },
  { pattern: /^tests\//, area: 'tests' },
  { pattern: /^docs\//, area: 'docs' },
  { pattern: /^\.github\//, area: 'ci' },
  { pattern: /package\.json$/, area: 'dependencies' },
  { pattern: /tsconfig\.json$/, area: 'build-config' },
]

const REVIEWER_BY_AREA: Record<string, string[]> = {
  cli: ['the-doorman', 'the-steward'],
  workflows: ['the-architect', 'the-steward'],
  agents: ['the-architect', 'the-reviewer'],
  memory: ['the-architect', 'the-oracle'],
  rag: ['the-architect', 'the-reviewer'],
  llm: ['the-architect', 'the-envoy'],
  skills: ['the-architect', 'the-scribe'],
  reasoning: ['the-architect', 'the-steward'],
  core: ['the-architect', 'the-reviewer'],
  members: ['the-sentinel', 'the-oracle'],
  'skill-files': ['the-sentinel', 'the-oracle'],
  tests: ['the-tester'],
  docs: ['the-librarian'],
  ci: ['the-doorman'],
  dependencies: ['the-auditor'],
  'build-config': ['the-steward'],
}

export class DiffImpactAnalyzer {
  analyze(diffBase: string = 'main', head: string = 'HEAD'): ImpactAnalysis {
    const cwd = process.cwd()

    const rawDiff = execSync(`git diff ${diffBase}...${head} --numstat`, { cwd, encoding: 'utf-8', stdio: 'pipe' })
    const rawNames = execSync(`git diff ${diffBase}...${head} --name-status`, { cwd, encoding: 'utf-8', stdio: 'pipe' })

    const files: DiffFile[] = []
    const statusLines = rawNames.trim().split('\n').filter(Boolean)
    const statLines = rawDiff.trim().split('\n').filter(Boolean)

    for (let i = 0; i < statusLines.length; i++) {
      const parts = statusLines[i].split('\t')
      const statusChar = parts[0][0]
      let path: string
      let status: DiffFile['status']

      if (statusChar === 'R') {
        status = 'renamed'
        path = parts[parts.length - 1]
      } else if (statusChar === 'A') {
        status = 'added'
        path = parts[1] || parts[0].slice(1).trim()
      } else if (statusChar === 'D') {
        status = 'deleted'
        path = parts[1] || parts[0].slice(1).trim()
      } else {
        status = 'modified'
        path = parts[1] || parts[0].slice(1).trim()
      }

      const statParts = statLines[i]?.split('\t') || ['0', '0']
      const additions = parseInt(statParts[0], 10) || 0
      const deletions = parseInt(statParts[1], 10) || 0

      files.push({ path, status, additions, deletions })
    }

    const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
    const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)
    const totalFiles = files.length

    const affectedAreas = this.classifyAreas(files)

    const suggestedReviewers = this.suggestReviewers(affectedAreas)

    const riskLevel = this.calculateRisk(files, affectedAreas)
    const breaking = this.detectBreaking(files)

    return { files, totalAdditions, totalDeletions, totalFiles, affectedAreas, riskLevel, suggestedReviewers, breaking }
  }

  private classifyAreas(files: DiffFile[]): string[] {
    const areas = new Set<string>()
    for (const file of files) {
      for (const { pattern, area } of AREA_PATTERNS) {
        if (pattern.test(file.path)) {
          areas.add(area)
        }
      }
    }
    return Array.from(areas).sort()
  }

  private suggestReviewers(areas: string[]): string[] {
    const reviewers = new Set<string>()
    for (const area of areas) {
      const mapped = REVIEWER_BY_AREA[area]
      if (mapped) {
        for (const r of mapped) reviewers.add(r)
      }
    }
    return Array.from(reviewers).sort()
  }

  private calculateRisk(files: DiffFile[], areas: string[]): 'low' | 'medium' | 'high' {
    const totalChanges = files.reduce((s, f) => s + f.additions + f.deletions, 0)

    if (areas.includes('core') || areas.includes('dependencies') || areas.includes('build-config')) return 'high'
    if (areas.includes('cli') || areas.includes('workflows') || areas.includes('agents') || areas.includes('llm')) {
      return totalChanges > 200 ? 'high' : 'medium'
    }
    if (totalChanges > 500) return 'high'
    if (totalChanges > 100) return 'medium'
    return 'low'
  }

  private detectBreaking(files: DiffFile[]): boolean {
    for (const file of files) {
      const name = file.path.split('/').pop() || ''
      if (name === 'package.json' || name === 'tsconfig.json') return true
      if (file.path.startsWith('src/core/') && file.status !== 'added') return true
      if (file.path.startsWith('src/workflows/') && file.path.endsWith('types.ts')) return true
      if (file.path.startsWith('src/members/') && file.path.endsWith('types.ts')) return true
    }
    return false
  }
}
