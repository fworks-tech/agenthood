import type { ISkill } from '../skills/ISkill.js'

export interface RiskPolicy {
  allowedPaths: string[]
  blockedPaths: string[]
  allowedHosts: string[]
  maxExecutionMs: number
  maxFileSizeBytes: number
}

export interface RiskViolation {
  type: 'path' | 'host' | 'timeout' | 'filesize'
  skill: string
  reason: string
  input: unknown
}

type Executor = (input: unknown, context: unknown) => Promise<unknown>

const DEFAULT_POLICY: RiskPolicy = {
  allowedPaths: ['**'],
  blockedPaths: [],
  allowedHosts: ['**'],
  maxExecutionMs: 30_000,
  maxFileSizeBytes: 5 * 1024 * 1024,
}

function matchesGlob(pattern: string, value: string): boolean {
  if (pattern === '**') return true
  const parts = pattern.split('/')
  const valueParts = value.replace(/\\/g, '/').split('/')

  let pi = 0
  let vi = 0
  let backtrackP = -1
  let backtrackV = -1

  while (vi < valueParts.length) {
    if (pi < parts.length && (parts[pi] === '**')) {
      backtrackP = pi
      backtrackV = vi
      pi++
    } else if (pi < parts.length && (parts[pi] === valueParts[vi] || parts[pi] === '*')) {
      pi++
      vi++
    } else if (backtrackP !== -1) {
      pi = backtrackP + 1
      vi = ++backtrackV
    } else {
      return false
    }
  }

  while (pi < parts.length && parts[pi] === '**') pi++

  return pi >= parts.length
}

export class RiskManager {
  constructor(private policy: RiskPolicy = DEFAULT_POLICY) {}

  validate(skill: ISkill, input: unknown): RiskViolation | null {
    const skillName = skill.name.toLowerCase()
    const inputObj = input as Record<string, unknown> || {}

    if (skillName.includes('write') || skillName.includes('refactor')) {
      const filePath = String(inputObj.path || inputObj.filePath || '')
      if (filePath) {
        for (const blocked of this.policy.blockedPaths) {
          if (matchesGlob(blocked, filePath)) {
            return {
              type: 'path',
              skill: skill.name,
              reason: `Path "${filePath}" is blocked by pattern "${blocked}"`,
              input,
            }
          }
        }

        const allowed = this.policy.allowedPaths.some((p) => matchesGlob(p, filePath))
        if (!allowed) {
          return {
            type: 'path',
            skill: skill.name,
            reason: `Path "${filePath}" is not in allowed paths: ${this.policy.allowedPaths.join(', ')}`,
            input,
          }
        }

        if (skillName.includes('write') && skillName !== 'writefile') {
          const content = String(inputObj.content || '')
          if (content.length > this.policy.maxFileSizeBytes) {
            return {
              type: 'filesize',
              skill: skill.name,
              reason: `Content size ${content.length} bytes exceeds max ${this.policy.maxFileSizeBytes} bytes`,
              input,
            }
          }
        }
      }
    }

    if (skillName.includes('web')) {
      const url = String(inputObj.url || inputObj.host || '')
      if (url) {
        const host = extractHost(url)
        if (host && !this.policy.allowedHosts.some((h) => matchesGlob(h, host))) {
          return {
            type: 'host',
            skill: skill.name,
            reason: `Host "${host}" is not in allowed hosts: ${this.policy.allowedHosts.join(', ')}`,
            input,
          }
        }
      }
    }

    return null
  }

  wrap(executor: Executor): Executor {
    const policy = this.policy
    return async (input: unknown, context: unknown) => {
      const result = await Promise.race([
        executor(input, context),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Execution timed out after ${policy.maxExecutionMs}ms`)), policy.maxExecutionMs),
        ),
      ])
      return result
    }
  }
}

function extractHost(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname
  } catch {
    if (url.includes('.')) return url.split('/')[0].split(':')[0]
    return null
  }
}
