/**
 * src/workflows/chains.ts
 *
 * `chains.yaml` is the project's composition surface: an ordered list of
 * members that form a workflow. Before 4.0 the file was committed but nothing
 * read it. Here it becomes a runtime input that executes through
 * WorkflowEngine, with every step run by MemberRunner so decisions,
 * provenance and events are recorded exactly as a direct `run` would.
 *
 * Sequential steps only by design (#609). `guards.stop_on_blocking` stops the
 * chain when a member reports `[blocking]` (the reviewer/doorman convention),
 * and `max_rounds` re-runs the sequence up to that many times. The remaining
 * guard keys are policy for the live orchestrator and are parsed but not
 * enforced here.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { LLMConfig } from '../llm/types.ts'
import type { MemberRunner } from '../runtime/MemberRunner.ts'
import { WorkflowEngine } from './WorkflowEngine.ts'
import type { IProtocol, ProtocolConfig } from './protocols/IProtocol.ts'
import type { WorkflowDefinition } from './types.ts'

export const CHAINS_FILE = 'chains.yaml'

export interface ChainStep {
  member: string
  /** Overrides the chain's shared task for this step. */
  task?: string
}

export interface ChainGuards {
  stop_on_blocking?: boolean
  doorman_before_merge?: boolean
  scribe_before_commit?: boolean
}

export interface ChainDefinition {
  name: string
  steps: ChainStep[]
  guards: ChainGuards
  maxRounds: number
}

/** A step reported a blocking finding and the chain must stop. */
export class ChainBlockedError extends Error {
  constructor(readonly member: string) {
    super(`Chain stopped: "${member}" reported a blocking finding`)
    this.name = 'ChainBlockedError'
  }
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be a mapping`)
  }
  return value as Record<string, unknown>
}

function toChain(raw: unknown, index: number): ChainDefinition {
  const where = `${CHAINS_FILE} chains[${index}]`
  const record = asRecord(raw, where)
  const name = record.name
  if (typeof name !== 'string' || !name.trim()) throw new Error(`${where}.name must be a non-empty string`)

  const sequence = record.sequence
  if (!Array.isArray(sequence) || sequence.length === 0) {
    throw new Error(`${where}.sequence must be a non-empty list`)
  }
  const steps = sequence.map((entry, i): ChainStep => {
    const step = asRecord(entry, `${where}.sequence[${i}]`)
    if (typeof step.member !== 'string' || !step.member.trim()) {
      throw new Error(`${where}.sequence[${i}].member must be a non-empty string`)
    }
    if (step.task !== undefined && typeof step.task !== 'string') {
      throw new Error(`${where}.sequence[${i}].task must be a string`)
    }
    return { member: step.member, ...(step.task ? { task: step.task } : {}) }
  })

  const guards = record.guards === undefined ? {} : asRecord(record.guards, `${where}.guards`)
  const maxRounds = record.max_rounds === undefined ? 1 : Number(record.max_rounds)
  if (!Number.isInteger(maxRounds) || maxRounds < 1) {
    throw new Error(`${where}.max_rounds must be a positive integer`)
  }

  return {
    name,
    steps,
    guards: {
      stop_on_blocking: guards.stop_on_blocking === true,
      doorman_before_merge: guards.doorman_before_merge === true,
      scribe_before_commit: guards.scribe_before_commit === true,
    },
    maxRounds,
  }
}

/** Reads `chains.yaml` from the project root. An absent file is an empty list. */
export function loadChains(projectPath: string): ChainDefinition[] {
  const path = join(projectPath, CHAINS_FILE)
  if (!existsSync(path)) return []
  const raw = loadYaml(readFileSync(path, 'utf-8')) as unknown
  if (raw === undefined || raw === null) return []
  const root = asRecord(raw, CHAINS_FILE)
  if (root.chains === undefined) return []
  if (!Array.isArray(root.chains)) throw new Error(`${CHAINS_FILE}: "chains" must be a list`)
  return root.chains.map(toChain)
}

/** Chain → engine definition. Each step is an agent step carrying its member. */
export function toWorkflowDefinition(chain: ChainDefinition, task: string): WorkflowDefinition {
  return {
    name: chain.name,
    description: `Chain ${chain.name}`,
    steps: chain.steps.map((step, index) => ({
      name: `${chain.name}:${index}:${step.member}`,
      type: 'agent',
      input: { member: step.member, task: step.task ?? task },
    })),
  }
}

export interface ChainRunResult {
  member: string
  output: string
}

const NO_RETRY: ProtocolConfig = { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 0 }

/** Runs one chain step through MemberRunner. Retries are handled at chain level. */
export class MemberProtocol implements IProtocol<{ member: string; task: string }, ChainRunResult> {
  name = 'member-protocol'
  config = NO_RETRY

  constructor(
    private readonly runner: Pick<MemberRunner, 'runMemberTask'>,
    private readonly llmConfig: LLMConfig,
    private readonly stopOnBlocking: boolean,
  ) {}

  async execute(input: { member: string; task: string }): Promise<ChainRunResult> {
    const { output } = await this.runner.runMemberTask(input.member, input.task, this.llmConfig)
    if (this.stopOnBlocking && /\[blocking\]/i.test(output)) throw new ChainBlockedError(input.member)
    return { member: input.member, output }
  }

  onFailure(): 'abort' {
    return 'abort'
  }
}

export interface ChainRunOptions {
  runner: Pick<MemberRunner, 'runMemberTask'>
  config: LLMConfig
  context: ExecutionContext
  /** Progress line sink; defaults to stdout. */
  log?: (line: string) => void
}

/** Executes a chain, re-running the sequence while a blocking round leaves budget. */
export async function runChain(chain: ChainDefinition, task: string, options: ChainRunOptions): Promise<ChainRunResult[]> {
  const log = options.log ?? ((line: string) => console.log(line))
  const engine = new WorkflowEngine()
  const protocol = new MemberProtocol(options.runner, options.config, chain.guards.stop_on_blocking === true)
  const definition = toWorkflowDefinition(chain, task)
  for (const step of definition.steps) step.protocol = protocol as IProtocol<unknown, unknown>

  for (let round = 1; round <= chain.maxRounds; round++) {
    if (round > 1) log(`\n[chain] ${chain.name}: round ${round} of ${chain.maxRounds}\n`)
    try {
      const context = await engine.execute(definition, options.context)
      return definition.steps.map((step) => {
        const result = context.stepResults.get(step.name) as ChainRunResult | undefined
        return result ?? { member: (step.input as { member: string }).member, output: '' }
      })
    } catch (err) {
      if (err instanceof ChainBlockedError && round < chain.maxRounds) {
        log(`[chain] ${err.message} — starting round ${round + 1}`)
        continue
      }
      throw err
    }
  }
  return []
}
