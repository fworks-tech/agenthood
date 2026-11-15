import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { MemberRunner } from '../../src/runtime/MemberRunner.ts'
import { MemberRegistry } from '../../src/members/MemberRegistry.ts'
import type { CustomMemberDefinition } from '../../src/members/types.ts'
import type { ProviderName } from '../../src/members/types.ts'
import { AgentRegistry } from '../../src/core/AgentRegistry.ts'
import { AnomalyDetector } from '../../src/core/AnomalyDetector.ts'
import { EpisodeLearner } from '../../src/evals/EpisodeLearner.ts'
import { AskHumanSignal } from '../../src/tools/human/AskHumanTool.ts'
import { StubProvider, STUB_PROVIDER_ENV } from '../../src/llm/providers/StubProvider.ts'
import type { CheckpointData, CheckpointStore } from '../../src/checkpoint/RunCheckpoint.ts'
import type { RunEvent } from '../../src/core/RunEventBus.ts'
import type { LLMConfig } from '../../src/llm/types.ts'
import { createTestContext } from '../helpers/testContext.ts'

process.env[STUB_PROVIDER_ENV] = '1'

const CUSTOM: CustomMemberDefinition = {
  name: 'release-captain',
  description: 'Owns release readiness for one product',
  systemPrompt: 'You are the release captain. Verify the checklist before shipping.',
  model: 'custom-captain-model',
  // StubProvider is not a ProviderName by design; the integration test routes
  // to it explicitly so no real provider is ever constructed.
  preferredProvider: 'stub' as ProviderName,
}

// Atlaslink's real shape: providers[] without a shared top-level model.
const CONFIG: LLMConfig = { providers: [{ name: 'stub' }] }

function store(): CheckpointStore & { saved: CheckpointData[] } {
  const saved: CheckpointData[] = []
  return {
    saved,
    save: vi.fn((cp: CheckpointData) => {
      saved.push(cp)
    }),
    load: vi.fn(),
    updateStatus: vi.fn(),
  }
}

function makeRunner(checkpointStore?: CheckpointStore): MemberRunner {
  const members = new MemberRegistry()
  members.register(CUSTOM)
  const runner = new MemberRunner({
    agents: new AgentRegistry(),
    members,
    episodeLearner: new EpisodeLearner(),
    anomalyDetector: new AnomalyDetector(),
    alertsPath: 'test-alerts.ndjson',
    checkpointStore,
  })
  runner.ctx = createTestContext()
  return runner
}

function cleanup(runner: MemberRunner): void {
  const id = runner.ctx.correlationId ?? runner.ctx.executionId
  try {
    rmSync(join(process.cwd(), '.agenthood', 'trajectories', `${id}.json`))
  } catch {
    // already absent
  }
}

describe('custom member end-to-end (#1040)', () => {
  beforeEach(() => {
    StubProvider.resetScript()
  })

  afterEach(() => {
    StubProvider.resetScript()
  })

  it('runs through the real router and stamps the pinned model everywhere', async () => {
    StubProvider.enqueueScript([{ content: 'all clear' }])
    const checkpoints = store()
    const runner = makeRunner(checkpoints)
    const models: string[] = []
    runner.ctx.events.subscribe((e: RunEvent) => {
      if (e.type === 'reasoning') models.push(e.model)
    })

    try {
      const result = await runner.runMemberTask(CUSTOM.name, 'ship it', CONFIG)

      expect(result.output).toBe('all clear')
      expect(models).toEqual([CUSTOM.model])
      expect(checkpoints.saved[0]).toMatchObject({ member: 'release-captain', model: CUSTOM.model })
      expect(checkpoints.updateStatus).toHaveBeenCalledWith(expect.any(String), 'completed')
    } finally {
      cleanup(runner)
    }
  })

  it('parks on ask_human and resumes with the human reply', async () => {
    StubProvider.enqueueScript([
      { toolCalls: [{ id: 'call_1', name: 'ask_human', args: { question: 'Which region?' } }] },
      { content: 'deployed to eu-west' },
    ])
    const checkpoints = store()
    const runner = makeRunner(checkpoints)
    const events: string[] = []
    runner.ctx.events.subscribe((e: RunEvent) => events.push(e.type))

    try {
      const err = await runner.runMemberTask(CUSTOM.name, 'ship it', CONFIG).catch((e) => e)
      expect(err).toBeInstanceOf(AskHumanSignal)
      expect(events).toContain('run.awaiting_input')
      expect(events).not.toContain('run.failed')

      const parked = checkpoints.saved.at(-1)!
      checkpoints.load = vi.fn(() => parked)

      const resumed = await runner.runMemberTask(CUSTOM.name, 'ship it', CONFIG, {
        checkpointId: parked.id,
        reply: 'eu-west',
      })
      expect(resumed.output).toBe('deployed to eu-west')
      expect(events).toContain('run.finished')
    } finally {
      cleanup(runner)
    }
  })
})
