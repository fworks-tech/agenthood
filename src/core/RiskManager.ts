import type { ITool } from '../tools/ITool.js'

/** Per-tool constraints that define acceptable execution boundaries. */
export interface RiskPolicy {
  /** Glob patterns for paths a tool is allowed to write to (e.g. src/**) */
  allowedPaths: string[]
  /** Glob patterns for paths a tool must never write to (e.g. .git/**) */
  blockedPaths: string[]
  /** Glob patterns for hosts a web tool is allowed to call (e.g. api.github.com) */
  allowedHosts: string[]
  /** Maximum wall-clock time per tool invocation in milliseconds */
  maxExecutionMs: number
  /** Maximum file content size in bytes that a write tool may produce */
  maxFileSizeBytes: number
}

/** A structured record of a policy violation — returned instead of thrown so callers can audit decisions. */
export interface RiskViolation {
  type: 'path' | 'host' | 'timeout' | 'filesize'
  tool: string
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

/**
 * Simple glob matcher supporting * (single segment) and ** (multi-segment).
 * Uses backtracking so ** matches across directory boundaries.
 */
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

/**
 * Mediator that enforces per-tool safety constraints before execution.
 *
 * Two responsibilities:
 * 1. validate — Check tool input against the policy (paths, hosts, file size)
 *    and return a structured violation instead of throwing, so callers can log
 *    or escalate decisions.
 * 2. wrap — Enforce execution timeout by racing the executor against a timer.
 *
 * Designed to complement SafetyGuard (agent-loop caps) — RiskManager is the
 * per-invocation gate, SafetyGuard is the per-session monitor.
 */
export class RiskManager {
  constructor(private policy: RiskPolicy = DEFAULT_POLICY) {}

  /**
   * Validate a skill invocation against the current policy.
   *
   * Checks depend on the skill name convention:
   * - Write/refactor skills are checked against path allow/block lists and file size limits
   * - Web skills are checked against allowed host patterns
   * - Other skills pass through with no validation (returns null)
   *
   * @returns A RiskViolation if the input violates policy, or null if allowed
   */
  validate(tool: ITool, input: unknown): RiskViolation | null {
    const toolName = tool.name.toLowerCase()
    const inputObj = input as Record<string, unknown> || {}

    if (toolName.includes('write') || toolName.includes('refactor')) {
      const filePath = String(inputObj.path || inputObj.filePath || '')
      if (filePath) {
        for (const blocked of this.policy.blockedPaths) {
          if (matchesGlob(blocked, filePath)) {
            return {
              type: 'path',
              tool: tool.name,
              reason: `Path "${filePath}" is blocked by pattern "${blocked}"`,
              input,
            }
          }
        }

        const allowed = this.policy.allowedPaths.some((p) => matchesGlob(p, filePath))
        if (!allowed) {
          return {
            type: 'path',
            tool: tool.name,
            reason: `Path "${filePath}" is not in allowed paths: ${this.policy.allowedPaths.join(', ')}`,
            input,
          }
        }

        if (toolName.includes('write') && toolName !== 'writefile') {
          const content = String(inputObj.content || '')
          if (content.length > this.policy.maxFileSizeBytes) {
            return {
              type: 'filesize',
              tool: tool.name,
              reason: `Content size ${content.length} bytes exceeds max ${this.policy.maxFileSizeBytes} bytes`,
              input,
            }
          }
        }
      }
    }

    if (toolName.includes('web')) {
      const url = String(inputObj.url || inputObj.host || '')
      if (url) {
        const host = extractHost(url)
        if (host && !this.policy.allowedHosts.some((h) => matchesGlob(h, host))) {
          return {
            type: 'host',
            tool: tool.name,
            reason: `Host "${host}" is not in allowed hosts: ${this.policy.allowedHosts.join(', ')}`,
            input,
          }
        }
      }
    }

    return null
  }

  /**
   * Wrap an executor with a timeout enforced via Promise.race.
   * The returned function has the same signature as the original executor
   * so it can be used as a transparent drop-in replacement.
   */
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

/** Extract hostname from a URL string, handling missing protocol and malformed input. */
function extractHost(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname
  } catch {
    if (url.includes('.')) return url.split('/')[0].split(':')[0]
    return null
  }
}
