import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LLMRequest, LLMResponse } from './types.ts'

const REDACT_PATTERN =
  /(?:api[_-]?key|token|secret|password|credential|bearer|pat|jwt)['":\s]*[=:]\s*['"]?[A-Za-z0-9\-_.~+/]+=*['"]?|\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|(?:sk|pk)_live_[0-9a-zA-Z]{16,}|glpat-[A-Za-z0-9_-]{20,})\b/gi

function redact(value: string): string {
  return value.replace(REDACT_PATTERN, '[REDACTED]')
}

/** A model can quote a secret back, and tools carry their own payloads: every
 *  string in the dump is redacted, not just the request messages. */
function redactDeep(value: unknown): unknown {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map(redactDeep)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactDeep(nested)]))
  }
  return value
}

export function writeDebugDump(
  projectDir: string,
  correlationId: string | undefined,
  provider: string,
  model: string,
  request: LLMRequest,
  response: LLMResponse,
  durationMs: number,
): void {
  const debugDir = join(projectDir, '.agenthood', 'debug')
  if (!existsSync(debugDir)) {
    mkdirSync(debugDir, { recursive: true })
  }

  const filename = `${Date.now()}-${(correlationId ?? 'unknown').slice(0, 8)}.json`
  const data = {
    timestamp: new Date().toISOString(),
    correlationId,
    provider,
    model,
    request: {
      messages: request.messages.map((m) => ({
        role: m.role,
        content: redact(m.content),
        ...(m.toolCalls ? { toolCalls: redactDeep(m.toolCalls) } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: redactDeep(request.tools),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    },
    response: {
      content: redact(response.content),
      toolCalls: redactDeep(response.toolCalls),
      usage: response.usage,
      model: response.model,
    },
    durationMs,
  }

  writeFileSync(join(debugDir, filename), JSON.stringify(data, null, 2) + '\n', 'utf-8')
}
