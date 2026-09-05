import { join } from 'node:path'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { AnomalyDetector } from '../core/AnomalyDetector.ts'
import { appendAnomalies } from '../core/AnomalyDetector.ts'
import { LLMRouter } from '../llm/LLMRouter.ts'
import type { LLMConfig } from '../llm/types.ts'
import { MemberAgent } from '../members/index.ts'
import type { MemberRegistry } from '../members/MemberRegistry.ts'
import type { ProviderName } from '../members/types.ts'
import { MetricsCollector } from '../memory/MetricsCollector.ts'
import type { MemberRunResult } from '../evals/EvalRunner.ts'
import type { AgentRegistry } from '../core/AgentRegistry.ts'
import type { EpisodeLearner } from '../evals/EpisodeLearner.ts'
import { ReActLoop } from '../reasoning/ReActLoop.ts'
import { ToolRegistry } from '../tools/ToolRegistry.ts'
import { AskHumanSignal, AskHumanTool } from '../tools/human/AskHumanTool.ts'
import { redactEventText } from '../core/RunEventBus.ts'
import { RunCheckpoint, type CheckpointData } from '../checkpoint/RunCheckpoint.ts'

export interface MemberRunnerDeps {
  agents: AgentRegistry
  members: MemberRegistry
  episodeLearner: EpisodeLearner
  anomalyDetector: AnomalyDetector
  alertsPath: string
}

/**
 * Runs members and core agents, flushes traces, and scores anomalies. The
 * shared ExecutionContext is assigned by the composition root after it is
 * fully built, so member runs observe the same context as the rest of the
 * application. Kept out of ApplicationContext to bound its size (warden).
 */
export class MemberRunner {
  ctx!: ExecutionContext

  constructor(private readonly deps: MemberRunnerDeps) {}

  /** Member-specific executor: preferred provider + its own tool loop */
  async runMember(memberName: string, task: string, config: LLMConfig, resumeFrom?: string): Promise<boolean> {
    if (!this.deps.members.has(memberName)) return false

    const spec = this.deps.members.get(memberName)
    await this.runAndReport(spec.name, async () => {
      const { output } = await this.runMemberTask(memberName, task, config, resumeFrom)
      return output
    })
    return true
  }

  /**
   * Runs a member without any presentation: captures the raw output and
   * duration for evaluation while still recording metrics and flushing
   * traces. Throws on failure instead of exiting the process.
   *
   * @param resumeFrom - optional checkpoint ID to resume from
   */
  async runMemberTask(memberName: string, task: string, config: LLMConfig, resumeFrom?: string): Promise<MemberRunResult> {
    if (!this.deps.members.has(memberName)) throw new Error(`unknown member "${memberName}"`)

    const spec = this.deps.members.get(memberName)
    const memberProvider = (config.provider ?? spec.preferredProvider) as ProviderName
    const llm = await LLMRouter.createForMember(memberProvider, config)
    const sReg = new ToolRegistry()
    if (!sReg.has('ask_human')) sReg.register(new AskHumanTool())

    const checkpointStore = new RunCheckpoint(process.cwd())
    const checkpointId = resumeFrom ?? RunCheckpoint.generateId(this.ctx.correlationId ?? crypto.randomUUID())

    let checkpointData: CheckpointData
    if (resumeFrom) {
      const existing = checkpointStore.load(resumeFrom)
      if (!existing) throw new Error(`checkpoint "${resumeFrom}" not found`)
      checkpointData = existing
      console.log(`\n  Resuming from step ${checkpointData.step} (checkpoint ${resumeFrom})\n`)
    } else {
      checkpointData = {
        id: checkpointId,
        member: spec.name,
        task,
        step: 0,
        messages: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: '',
        activatedSkills: [],
        status: 'running',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      checkpointStore.save(checkpointData)
    }

    const loop = new ReActLoop(llm, sReg, {
      interactive: config.interactive,
      onStepComplete: (step, messages, usage, model) => {
        checkpointData.step = step
        checkpointData.messages = messages.map((m) => ({ role: m.role, content: m.content, toolCallId: m.tool_call_id }))
        checkpointData.usage = { ...usage }
        checkpointData.model = model
        checkpointData.activatedSkills = Array.from(loop.activatedSkills)
        checkpointStore.save(checkpointData)
      },
    })

    if (config.skills?.autoDiscover === true) {
      try {
        await sReg.discover(join(process.cwd(), 'src', 'skills'))
      } catch (e) {
        console.warn(`[run] skill auto-discovery failed: ${(e as Error)?.message ?? e}`)
      }
    }

    const agent = new MemberAgent(spec, llm, loop, sReg, { agentRegistry: this.deps.agents, episodeLearner: this.deps.episodeLearner, strictSkillIntegrity: config.security?.strictSkillIntegrity })
    const metricsCollector = new MetricsCollector(join(process.cwd(), '.agenthood', 'metrics'))
    const startTime = performance.now()
    const timestamp = new Date().toISOString()
    const events = this.ctx.events

    try {
      events.emit({
        type: 'run.started',
        executionId: this.ctx.executionId,
        member: spec.name,
        correlationId: this.ctx.correlationId,
        timestamp,
        task: redactEventText(this.ctx, task),
      })

      const result = await agent.run(task, this.ctx)
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(memberName, true, duration)
      checkpointStore.updateStatus(checkpointId, 'completed')
      events.emit({
        type: 'run.finished',
        executionId: this.ctx.executionId,
        member: spec.name,
        correlationId: this.ctx.correlationId,
        timestamp: new Date().toISOString(),
        output: redactEventText(this.ctx, result.output),
        durationMs: duration,
      })
      return { output: result.output, durationMs: duration }
    } catch (err) {
      const duration = Math.round(performance.now() - startTime)
      // a parked run is awaiting human input, not a failure: emit the park
      // event (redacted), skip the failure metrics write, and rethrow so the
      // host can resume the run when the reply arrives
      if (err instanceof AskHumanSignal) {
        events.emit({
          type: 'run.awaiting_input',
          executionId: this.ctx.executionId,
          member: spec.name,
          correlationId: this.ctx.correlationId,
          timestamp: new Date().toISOString(),
          question: redactEventText(this.ctx, err.payload.question),
          ...(err.payload.context !== undefined ? { context: redactEventText(this.ctx, err.payload.context) } : {}),
          durationMs: duration,
        })
        throw err
      }
      metricsCollector.record(memberName, false, duration)
      checkpointStore.updateStatus(checkpointId, 'failed')
      events.emit({
        type: 'run.failed',
        executionId: this.ctx.executionId,
        member: spec.name,
        correlationId: this.ctx.correlationId,
        timestamp: new Date().toISOString(),
        error: redactEventText(this.ctx, err instanceof Error ? err.message : String(err)),
        durationMs: duration,
      })
      throw err
    } finally {
      await this.flushTraces()
    }
  }

  /** Fallback for non-member agent names (core agents). */
  async runAgent(agentName: string, task: string): Promise<void> {
    await this.runAndReport(agentName, async () => {
      const agent = this.deps.agents.get(agentName)
      return (await agent.run(task, this.ctx)).output
    })
  }

  private async runAndReport(
    displayName: string,
    run: () => Promise<string>,
  ): Promise<void> {
    try {
      const output = await run()
      console.log(`\n\u2714 ${displayName} result:\n${output}\n`)
    } catch (err) {
      await this.flushTraces()
      // logging and exit belong to the CLI caller; surface the error here
      throw err
    }
    await this.flushTraces()
  }

  /** Flushes pending trace envelopes to the store before the process exits. */
  async flushTraces(): Promise<void> {
    try {
      await this.ctx.tracer.flush()
      await this.evaluateAnomalies()
    } catch (err) {
      console.error(`[run] trace flush failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** Scores the recent in-process envelopes and appends any anomalies. */
  private async evaluateAnomalies(): Promise<void> {
    const recent = this.ctx.tracer.getRecent(this.ctx.tracer.size)
    if (recent.length === 0) return
    const anomalies = this.deps.anomalyDetector.evaluate(recent)
    if (anomalies.length === 0) return
    try {
      await appendAnomalies(this.deps.alertsPath, anomalies)
    } catch (err) {
      console.warn(`[run] anomaly persistence failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
