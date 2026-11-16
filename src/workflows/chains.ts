/**
 * src/workflows/chains.ts
 *
 * `chains.yaml` is the project's composition surface: an ordered list of
 * members and skills that form a workflow. Before 4.0 the file was committed
 * but nothing read it. Here it becomes a runtime input that executes through
 * WorkflowEngine, with every step run by MemberRunner so decisions, provenance
 * and events are recorded exactly as a direct `run` would.
 *
 * A step is a `member` (the existing form), a `skill` run by an agent
 * (`/skill-name` activation, default agent `builder`), or a `parallel` group of
 * steps that run concurrently (#609). `when` runs a step only when an earlier
 * step's output matches, which is how a review gate skips the fix step.
 *
 * `guards.stop_on_blocking` stops the chain when a member reports `[blocking]`
 * (the reviewer/doorman convention), and `max_rounds` re-runs the sequence up to
 * that many times. The remaining guard keys are policy for the live orchestrator
 * and are parsed but not enforced here.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { LLMConfig } from '../llm/types.ts'
import type { MemberRunner } from '../runtime/MemberRunner.ts'
import { WorkflowEngine } from './WorkflowEngine.ts'
import type { IProtocol, ProtocolConfig } from './protocols/IProtocol.ts'
import type { StepCondition, WorkflowDefinition, WorkflowStep } from './types.ts'

export const CHAINS_FILE = 'chains.yaml'

export interface ChainStep {
  /** A Society member runs this step. Exactly one of member/skill/parallel. */
  member?: string
  /** A skill activated with `/name` before the model sees the task (#609). */
  skill?: string
  /** The member that runs a skill step; default `builder`. */
  agent?: string
  /** Overrides the chain's shared task for this step. */
  task?: string
  /** Steps that run concurrently. A failure fails the group. */
  parallel?: ChainStep[]
  /** Run only when an earlier step's output matches (#609). */
  when?: StepCondition
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

/** The name a `when.step` refers to: a member name, a skill name, or `parallel`. */
export function chainStepLabel(step: ChainStep): string {
  return step.member ?? step.skill ?? 'parallel'
}

function parseCondition(raw: unknown, where: string): StepCondition {
  const record = asRecord(raw, `${where}.when`)
  if (typeof record.step !== 'string' || !record.step.trim()) {
    throw new Error(`${where}.when.step must name an earlier step`)
  }
  const condition: StepCondition = { step: record.step }
  for (const key of ['contains', 'notContains'] as const) {
    const value = record[key]
    if (value === undefined) continue
    if (typeof value !== 'string') throw new Error(`${where}.when.${key} must be a string`)
    condition[key] = value
  }
  if (condition.contains === undefined && condition.notContains === undefined) {
    throw new Error(`${where}.when needs "contains" or "notContains"`)
  }
  return condition
}

function toStep(raw: unknown, where: string, allowWhen = true): ChainStep {
  const step = asRecord(raw, where)
  const kinds = ['member', 'skill', 'parallel'].filter((key) => step[key] !== undefined)
  if (kinds.length !== 1) {
    throw new Error(`${where} needs exactly one of "member", "skill" or "parallel"`)
  }
  const task = step.task
  if (task !== undefined && typeof task !== 'string') throw new Error(`${where}.task must be a string`)
  const when = step.when === undefined ? undefined : parseCondition(step.when, where)
  if (when && !allowWhen) {
    throw new Error(`${where}.when is not allowed inside a parallel group, branches run concurrently`)
  }

  if (step.parallel !== undefined) {
    if (!Array.isArray(step.parallel) || step.parallel.length === 0) {
      throw new Error(`${where}.parallel must be a non-empty list`)
    }
    for (const key of ['member', 'skill', 'agent', 'task']) {
      if (step[key] !== undefined) throw new Error(`${where}.${key} belongs on a branch, not on the group`)
    }
    return {
      parallel: step.parallel.map((entry, i) => toStep(entry, `${where}.parallel[${i}]`, false)),
      ...(when ? { when } : {}),
    }
  }

  if (step.member !== undefined) {
    if (typeof step.member !== 'string' || !step.member.trim()) {
      throw new Error(`${where}.member must be a non-empty string`)
    }
    if (step.agent !== undefined) throw new Error(`${where}.agent only applies to a skill step`)
    if (step.skill !== undefined) throw new Error(`${where} cannot be both member and skill`)
    return { member: step.member, ...(task ? { task } : {}), ...(when ? { when } : {}) }
  }

  if (typeof step.skill !== 'string' || !step.skill.trim()) {
    throw new Error(`${where}.skill must be a non-empty string`)
  }
  if (step.agent !== undefined && (typeof step.agent !== 'string' || !step.agent.trim())) {
    throw new Error(`${where}.agent must be a non-empty string`)
  }
  return {
    skill: step.skill,
    ...(step.agent ? { agent: step.agent } : {}),
    ...(task ? { task } : {}),
    ...(when ? { when } : {}),
  }
}

/** A `when.step` must name a step that ran earlier at the same level. */
function validateConditions(steps: ChainStep[], where: string): void {
  const seen = new Set<string>()
  steps.forEach((step, i) => {
    if (step.when && !seen.has(step.when.step)) {
      throw new Error(
        `${where}[${i}].when.step "${step.when.step}" is not an earlier step: available: ${[...seen].join(', ') || '(none)'}`,
      )
    }
    seen.add(chainStepLabel(step))
    // A later step may gate on a branch of an earlier parallel group.
    for (const branch of step.parallel ?? []) seen.add(chainStepLabel(branch))
  })
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
  const steps = sequence.map((entry, i) => toStep(entry, `${where}.sequence[${i}]`))
  validateConditions(steps, `${where}.sequence`)

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

/** A skill step runs as `/<skill> <task>` so activation, budget and gating all apply. */
function stepInput(step: ChainStep, task: string): { member: string; task: string; skill?: string } {
  if (step.skill) {
    const runner = step.agent ?? 'builder'
    return { member: runner, task: `/${step.skill} ${step.task ?? task}`, skill: step.skill }
  }
  return { member: step.member as string, task: step.task ?? task }
}

/** Chain → engine definition. Step names are stable and conditions resolve to them. */
export function toWorkflowDefinition(chain: ChainDefinition, task: string): WorkflowDefinition {
  const names = new Map<string, string>()
  const steps: WorkflowStep[] = chain.steps.map((step, index) => {
    const name = `${chain.name}:${index}:${chainStepLabel(step)}`
    const when = step.when ? { ...step.when, step: names.get(step.when.step) ?? step.when.step } : undefined
    names.set(chainStepLabel(step), name)

    if (step.parallel) {
      const subSteps = step.parallel.map((branch, i) => {
        const branchName = `${name}:${i}:${chainStepLabel(branch)}`
        names.set(chainStepLabel(branch), branchName)
        return { name: branchName, type: 'agent' as const, input: stepInput(branch, task) }
      })
      return { name, type: 'parallel', subSteps, ...(when ? { when } : {}) }
    }
    return { name, type: 'agent', input: stepInput(step, task), ...(when ? { when } : {}) }
  })
  return { name: chain.name, description: `Chain ${chain.name}`, steps }
}

export interface ChainRunResult {
  member: string
  /** Set when the step ran a skill rather than the member's own instructions. */
  skill?: string
  output: string
  /** A `when` condition was false; the step is reported but did not run. */
  skipped?: boolean
}

const NO_RETRY: ProtocolConfig = { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 0 }

/** Runs one chain step through MemberRunner. Retries are handled at chain level. */
export class MemberProtocol implements IProtocol<{ member: string; task: string; skill?: string }, ChainRunResult> {
  name = 'member-protocol'
  config = NO_RETRY

  constructor(
    private readonly runner: Pick<MemberRunner, 'runMemberTask'>,
    private readonly llmConfig: LLMConfig,
    private readonly stopOnBlocking: boolean,
  ) {}

  async execute(input: { member: string; task: string; skill?: string }): Promise<ChainRunResult> {
    const { output } = await this.runner.runMemberTask(input.member, input.task, this.llmConfig)
    if (this.stopOnBlocking && /\[blocking\]/i.test(output)) throw new ChainBlockedError(input.skill ?? input.member)
    return { member: input.member, ...(input.skill ? { skill: input.skill } : {}), output }
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

/** Engine step name → the label a chain author wrote (`review:0:reviewer` → `reviewer`). */
function chainLabel(step: WorkflowStep): string {
  return step.name.split(':').slice(-1)[0] ?? step.name
}

/**
 * Collect one top-level step's result in chain order. A parallel group reports
 * one result per branch, so the caller sees every step, not the group.
 */
function collectResults(step: WorkflowStep, result: unknown): ChainRunResult[] {
  if (step.type === 'parallel') {
    const nested = Array.isArray(result) ? result : []
    const branches = step.subSteps ?? []
    if (nested.length === 0) return [{ member: chainLabel(step), output: '', skipped: true }]
    return branches.flatMap((branch, i) => collectResults(branch, nested[i]))
  }
  if (result && typeof result === 'object' && 'output' in result) return [result as ChainRunResult]
  if ((result as { skipped?: boolean } | undefined)?.skipped === true) {
    return [{ member: chainLabel(step), output: '', skipped: true }]
  }
  return [{ member: chainLabel(step), output: '' }]
}

/** Executes a chain, re-running the sequence while a blocking round leaves budget. */
export async function runChain(chain: ChainDefinition, task: string, options: ChainRunOptions): Promise<ChainRunResult[]> {
  const log = options.log ?? ((line: string) => console.log(line))
  const engine = new WorkflowEngine()
  const protocol = new MemberProtocol(options.runner, options.config, chain.guards.stop_on_blocking === true)
  const definition = toWorkflowDefinition(chain, task)
  const attach = (steps: WorkflowStep[]): void => {
    for (const step of steps) {
      if (step.type === 'parallel') attach(step.subSteps ?? [])
      else step.protocol = protocol as IProtocol<unknown, unknown>
    }
  }
  attach(definition.steps)

  for (let round = 1; round <= chain.maxRounds; round++) {
    if (round > 1) log(`\n[chain] ${chain.name}: round ${round} of ${chain.maxRounds}\n`)
    try {
      const context = await engine.execute(definition, options.context)
      return definition.steps.flatMap((step) => collectResults(step, context.stepResults.get(step.name)))
    } catch (err) {
      if (err instanceof ChainBlockedError && round < chain.maxRounds) {
        log(`[chain] ${err.message}, starting round ${round + 1}`)
        continue
      }
      throw err
    }
  }
  return []
}
