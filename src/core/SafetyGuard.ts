/**
 * src/core/SafetyGuard.ts
 *
 * Enforces safety limits on agent execution. Every tool invocation, stream
 * event, and session duration is counted and capped. Loop detection prevents
 * runaway edits to the same file.
 *
 * Implements docs/architecture/built-in-tools.md safety caps and
 * docs/architecture/operating-modes.md permission profiles.
 */

import type { PermissionProfile } from '../members/types.ts'

// ---------------------------------------------------------------------------
// Cap configuration
// ---------------------------------------------------------------------------

export interface SafetyCaps {
  maxStreamEvents: number
  maxToolInvocations: number
  maxSessionRuntimeMs: number
  maxFileEditsPerFile: number
  maxTerminalCommands: number
  maxWebSearches: number
}

const DEFAULT_CAPS: SafetyCaps = {
  maxStreamEvents: 2_000,
  maxToolInvocations: 400,
  maxSessionRuntimeMs: 600_000,     // 10 minutes
  maxFileEditsPerFile: 8,
  maxTerminalCommands: 10,
  maxWebSearches: 8,
}

const MAXIMUM_CAPS: SafetyCaps = {
  maxStreamEvents: 10_000,
  maxToolInvocations: 2_000,
  maxSessionRuntimeMs: 3_600_000,   // 60 minutes
  maxFileEditsPerFile: 8,
  maxTerminalCommands: 10,
  maxWebSearches: 8,
}

// ---------------------------------------------------------------------------
// Catastrophic commands — blocked universally regardless of profile
// ---------------------------------------------------------------------------

const CATASTROPHIC_COMMANDS = [
  /^rm\s+-rf\s+\/$/,                          // rm -rf /
  /^rm\s+-rf\s+\/[*?]/,                        // rm -rf /*
  /^rm\s+-rf\s+~$/,                            // rm -rf ~
  /^mkfs/,                                      // mkfs
  /^dd\s+if=\/dev\/zero/,                      // dd if=/dev/zero
  /^\s*DROP\s+DATABASE\s+/i,                    // DROP DATABASE
  /^git\s+push\s+--force\s+origin\s+main$/i,    // force push to main
]

function isCatastrophic(command: string): boolean {
  return CATASTROPHIC_COMMANDS.some((re) => re.test(command.trim()))
}

// ---------------------------------------------------------------------------
// SafetyGuard
// ---------------------------------------------------------------------------

export class SafetyLimitError extends Error {
  constructor(limit: string, current: number, max: number) {
    super(`Safety limit reached: ${limit} (${current}/${max})`)
    this.name = 'SafetyLimitError'
  }
}

export class LoopDetectedError extends Error {
  constructor(filePath: string, edits: number) {
    super(`Loop detected: "${filePath}" edited ${edits} times in this session. Justify continued editing or stop.`)
    this.name = 'LoopDetectedError'
  }
}

export class CatastrophicCommandError extends Error {
  constructor(command: string) {
    super(`Blocked catastrophic command: "${command}"`)
    this.name = 'CatastrophicCommandError'
  }
}

export class SafetyGuard {
  private caps: SafetyCaps
  private sessionStart: number
  private streamEvents = 0
  private toolInvocations = 0
  private terminalCommands = 0
  private webSearches = 0
  private fileEditCounts = new Map<string, number>()
  private loopThreshold: number

  constructor(
    caps?: Partial<SafetyCaps>,
    private profile: PermissionProfile = 'standard',
  ) {
    this.caps = { ...DEFAULT_CAPS, ...caps }
    // Clamp caps to maximums
    for (const key of Object.keys(DEFAULT_CAPS) as (keyof SafetyCaps)[]) {
      this.caps[key] = Math.min(this.caps[key], MAXIMUM_CAPS[key])
    }
    this.sessionStart = Date.now()
    this.loopThreshold = 4
  }

  /** Check whether a terminal command is permitted given the profile. */
  checkCommand(command: string): void {
    // Catastrophic commands are blocked universally
    if (isCatastrophic(command)) {
      throw new CatastrophicCommandError(command)
    }

    // Profile-based blocking
    if (this.profile === 'restricted') {
      throw new SafetyLimitError('terminal commands', 0, 0)
    }

    this.countToolInvocation()
    this.terminalCommands++
    if (this.terminalCommands > this.caps.maxTerminalCommands) {
      throw new SafetyLimitError('terminal commands', this.terminalCommands, this.caps.maxTerminalCommands)
    }
  }

  /** Count a tool invocation and check the cap. */
  countToolInvocation(): void {
    this.toolInvocations++
    if (this.toolInvocations > this.caps.maxToolInvocations) {
      throw new SafetyLimitError('tool invocations', this.toolInvocations, this.caps.maxToolInvocations)
    }
  }

  /** Count a stream event and check the cap. */
  countStreamEvent(): void {
    this.streamEvents++
    if (this.streamEvents > this.caps.maxStreamEvents) {
      throw new SafetyLimitError('stream events', this.streamEvents, this.caps.maxStreamEvents)
    }
  }

  /** Check session runtime. */
  checkSessionRuntime(): void {
    const elapsed = Date.now() - this.sessionStart
    if (elapsed > this.caps.maxSessionRuntimeMs) {
      throw new SafetyLimitError(
        'session runtime',
        Math.floor(elapsed / 1000),
        Math.floor(this.caps.maxSessionRuntimeMs / 1000),
      )
    }
  }

  /** Register a file edit for loop detection. */
  registerFileEdit(filePath: string): void {
    const count = (this.fileEditCounts.get(filePath) ?? 0) + 1
    this.fileEditCounts.set(filePath, count)

    if (count >= this.loopThreshold) {
      // Alert but don't throw — member should justify or stop
      throw new LoopDetectedError(filePath, count)
    }

    // Also count as a tool invocation and check file-edits-per-file cap
    this.countToolInvocation()
    if (count > this.caps.maxFileEditsPerFile) {
      throw new SafetyLimitError('file edits per file', count, this.caps.maxFileEditsPerFile)
    }
  }

  /** Register a web search. */
  registerWebSearch(): void {
    this.webSearches++
    if (this.webSearches > this.caps.maxWebSearches) {
      throw new SafetyLimitError('web searches', this.webSearches, this.caps.maxWebSearches)
    }
  }

  /** Whether a file has exceeded the loop threshold. */
  hasLoop(filePath: string): boolean {
    return (this.fileEditCounts.get(filePath) ?? 0) >= this.loopThreshold
  }

  /** Remaining budget summary. */
  remainingBudget(): Record<string, string> {
    return {
      streamEvents: `${this.streamEvents}/${this.caps.maxStreamEvents}`,
      toolInvocations: `${this.toolInvocations}/${this.caps.maxToolInvocations}`,
      terminalCommands: `${this.terminalCommands}/${this.caps.maxTerminalCommands}`,
      webSearches: `${this.webSearches}/${this.caps.maxWebSearches}`,
    }
  }

  /** Reset all counters for a new session. */
  reset(): void {
    this.streamEvents = 0
    this.toolInvocations = 0
    this.terminalCommands = 0
    this.webSearches = 0
    this.fileEditCounts.clear()
    this.sessionStart = Date.now()
  }
}
