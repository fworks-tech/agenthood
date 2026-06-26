import type { MemberTrigger, TaskStage } from "./MemberTriggers.js"
import { MEMBER_TRIGGERS } from "./MemberTriggers.js"

export interface DetectionContext {
  userMessage: string
  changedFiles?: string[]
  currentStage?: TaskStage
  projectContext?: 'agenthood' | 'user-project'
  changedDirs?: string[]
}

export interface DetectionResult {
  member: string
  score: number
  matchedKeywords: string[]
  matchedFiles: string[]
  matchedStage: boolean
}

export class MemberOrchestrator {
  private triggers: MemberTrigger[]

  constructor(triggers: MemberTrigger[] = MEMBER_TRIGGERS) {
    this.triggers = triggers
  }

  detectMembers(context: DetectionContext): DetectionResult[] {
    const message = context.userMessage.toLowerCase()
    const changedFiles = context.changedFiles ?? []
    const changedDirs = context.changedDirs ?? []
    const currentStage = context.currentStage
    const results: DetectionResult[] = []

    for (const trigger of this.triggers) {
      let score = 0
      const matchedKeywords: string[] = []
      const matchedFiles: string[] = []

      for (const keyword of trigger.keywords) {
        if (message.includes(keyword.toLowerCase())) {
          score += 2
          matchedKeywords.push(keyword)
        }
      }

      const excludePatterns: string[] = []
      const includePatterns: string[] = []

      for (const pattern of trigger.filePatterns) {
        if (pattern.startsWith('!')) {
          excludePatterns.push(pattern.slice(1))
        } else {
          includePatterns.push(pattern)
        }
      }

      for (const pattern of includePatterns) {
        const globPrefix = pattern.replace('**/*', '')
        const basePattern = globPrefix.replace(/\*$/, '')

        for (const file of changedFiles) {
          if (this.matchFilePattern(file, pattern)) {
            if (!excludePatterns.some((ex) => this.matchFilePattern(file, ex))) {
              score += 1
              matchedFiles.push(file)
            }
          }
        }

        for (const dir of changedDirs) {
          if (dir.startsWith(basePattern) || basePattern.includes(dir)) {
            if (!excludePatterns.some((ex) => ex.includes(dir) || dir.includes(ex))) {
              score += 1
            }
          }
        }
      }

      if (currentStage && trigger.stages.includes(currentStage)) {
        score += 3
      }

      if (trigger.name === 'the-oracle' && context.projectContext === 'agenthood') {
        score += 2
      }

      if (trigger.name === 'the-oracle') {
        for (const memberName of ['the-scribe', 'the-architect', 'the-reviewer']) {
          if (message.includes(memberName)) {
            score += 1
          }
        }
      }

      if (score >= 2) {
        results.push({
          member: trigger.name,
          score,
          matchedKeywords,
          matchedFiles,
          matchedStage: currentStage ? trigger.stages.includes(currentStage) : false,
        })
      }
    }

    results.sort((a, b) => b.score - a.score)

    return results
  }

  getDefaultMember(results: DetectionResult[]): string | null {
    if (results.length === 0) return null
    return results[0].member
  }

  getForStage(stage: TaskStage): string[] {
    return this.triggers
      .filter((t) => t.stages.includes(stage))
      .map((t) => t.name)
  }

  private matchFilePattern(file: string, pattern: string): boolean {
    const cleanPattern = pattern.replace(/^!/, '')
    const parts = cleanPattern.split('**/*')
    const dirPrefix = parts[0]
    const suffix = parts[1] ?? ''

    if (!dirPrefix && !suffix) return true

    if (dirPrefix) {
      if (!file.startsWith(dirPrefix)) return false
    }

    if (suffix) {
      const fileName = file.split('/').pop() ?? ''
      const suffixRegex = new RegExp(
        suffix.replace(/\./g, '\\.').replace(/\*/g, '.*'),
      )
      if (!suffixRegex.test(fileName)) return false
    }

    return true
  }
}
