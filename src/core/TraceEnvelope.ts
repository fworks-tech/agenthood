import { contentHash } from "../utils/hash.ts"
import type { TraceEnvelope, TraceSource } from "./types.ts"

export interface CreateTraceEnvelopeInput {
  member: string
  input: string
  output: string
  durationMs: number
  tokenCount: TraceEnvelope["tokenCount"]
  cost: number
  qualityScore: number | null
  status: TraceEnvelope["status"]
  correlationId: string
  source?: TraceSource
  model?: string
  timestamp?: string
}

export function createTraceEnvelope(input: CreateTraceEnvelopeInput): TraceEnvelope {
  const envelope: TraceEnvelope = {
    member: input.member,
    inputHash: contentHash(input.input),
    outputHash: contentHash(input.output),
    durationMs: input.durationMs,
    tokenCount: input.tokenCount,
    cost: input.cost,
    qualityScore: input.qualityScore,
    status: input.status,
    correlationId: input.correlationId,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source ?? "api",
  }
  if (input.model) envelope.model = input.model
  return envelope
}
