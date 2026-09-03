import type { ExecutionContext } from './ExecutionContext.ts'
import type { AskHumanQuestions } from '../tools/human/AskHumanSignal.ts'

export interface RunEventBase {
  executionId: string
  member: string
  correlationId?: string
  timestamp: string
}

export type RunEvent =
  | (RunEventBase & { type: 'run.started'; task: string })
  | (RunEventBase & { type: 'reasoning'; step: number; content: string; model?: string; promptTokens?: number; completionTokens?: number; stepCost?: number; contextWindow?: number; contextUtil?: number })
  | (RunEventBase & { type: 'tool.called'; step: number; name: string; args: unknown })
  | (RunEventBase & { type: 'tool.result'; step: number; name: string; output: string; durationMs: number })
  | (RunEventBase & { type: 'decision.recorded'; decisionId: string; outcome: string })
  | (RunEventBase & { type: 'provenance.recorded'; checksum: string })
  | (RunEventBase & { type: 'run.finished'; output: string; durationMs: number })
  | (RunEventBase & { type: 'run.failed'; error: string; durationMs: number })
  | (RunEventBase & { type: 'run.awaiting_input'; question: AskHumanQuestions })

export type RunEventListener = (event: RunEvent) => void

/**
 * In-memory publisher for execution-lifecycle events. External hosts (e.g. the
 * atlaslink orchestrator) subscribe here to watch a run happen instead of
 * tailing persisted artifacts. A pure publisher: emitters redact payloads
 * before constructing events, and a misbehaving subscriber never breaks the run.
 */
export class RunEventBus {
  private readonly listeners = new Set<RunEventListener>()

  subscribe(listener: RunEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: RunEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error(`[RunEventBus] subscriber failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  get size(): number {
    return this.listeners.size
  }
}

/** Best-effort copy of the persistence redaction guarantee for event payloads;
 *  a failing or missing redactor drops the payload rather than the run. */
export function redactEventText(context: ExecutionContext, text: string): string {
  if (!context.redactor) return text
  try {
    return context.redactor.redactText(text)
  } catch (err) {
    console.warn(`[RunEventBus] event redaction failed: ${err instanceof Error ? err.message : String(err)}`)
    return ''
  }
}
