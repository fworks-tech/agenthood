import type { ILLMProvider } from './ILLMProvider.ts'
import type { LLMRequest } from './types.ts'
import type { RedactionFilter } from '../core/RedactionFilter.ts'

/**
 * Transparently redacts secrets/PII from outbound LLM request messages before
 * they reach any provider, so an accidental `sk-…` in a task, file, diff, or
 * tool output is never sent to a third party. Wrapping at provider
 * construction makes it unconditional — every caller (ReActLoop, tools, eval)
 * is covered without each one remembering to redact.
 *
 * The Proxy preserves the wrapped provider's prototype identity, so routing
 * checks (`instanceof`), `getContextWindow`, and `setModel` behave unchanged.
 * This is deliberately an *always-on* security guard: a config that disables
 * trace redaction must not silently disable key-leak protection.
 */
export function withRequestRedaction<T extends ILLMProvider>(provider: T, filter: RedactionFilter): T {
  return new Proxy(provider, {
    get(target, prop) {
      if (prop === 'complete') return (request: LLMRequest) => target.complete(redact(request, filter))
      if (prop === 'stream') return (request: LLMRequest) => target.stream(redact(request, filter))
      const value = (target as unknown as Record<PropertyKey, unknown>)[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function redact(request: LLMRequest, filter: RedactionFilter): LLMRequest {
  if (!filter.enabled()) return request
  return {
    ...request,
    messages: request.messages.map((m) => ({ ...m, content: filter.redactText(m.content) })),
  }
}
