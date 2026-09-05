import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LLMRequest, LLMResponse } from './types.ts'

const REDACT_PATTERN = /(?:api[_-]?key|token|secret|password|credential|bearer|pat|jwt)['":\s]*[=:]\s*['"]?[A-Za-z0-9\-_.~+/]+=*['"]?/gi

function redact(value: string): string {
  return value.replace(REDACT_PATTERN, '[REDACTED]')
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
        ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: request.tools,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    },
    response: {
      content: response.content,
      toolCalls: response.toolCalls,
      usage: response.usage,
      model: response.model,
    },
    durationMs,
  }

  writeFileSync(join(debugDir, filename), JSON.stringify(data, null, 2) + '\n', 'utf-8')
}
