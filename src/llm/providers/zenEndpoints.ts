/**
 * src/llm/providers/zenEndpoints.ts
 *
 * OpenCode Zen is not a single API. Each model family is served on its own
 * endpoint (https://opencode.ai/docs/zen/#endpoints), but the `opencode`
 * provider is built on the OpenAI chat-completions client, which only speaks
 * `/v1/chat/completions`. Asking it for a `/v1/messages` model (Claude,
 * qwen3.8-flash) or a `/v1/responses` model (GPT/Grok) 400s or hangs — which
 * surfaces to a caller as an agent that never answers.
 *
 * This module is the single source of truth for "which endpoint does this Zen
 * model live on", so the provider can route to the right protocol instead of
 * assuming chat. Pure and dependency-free: the model catalog rotates, so keep
 * the prefix sets aligned with the Zen docs and the live `/v1/models` list.
 */

export type ZenProtocol = 'chat' | 'messages' | 'responses' | 'systemone'

// Qwen is split across endpoints — qwen3.8-max is chat-completions while
// qwen3.8-flash and the qwen3.x plus/max are Anthropic-style messages — so it
// is matched by explicit id, never a `qwen` prefix.
const MESSAGES_EXACT = new Set([
  'qwen3.8-flash',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.6-plus',
  'qwen3.5-plus',
])
const RESPONSES_PREFIXES = ['gpt-', 'grok-', 'muse-spark']

export function isZenMessagesModel(model: string): boolean {
  return model.startsWith('claude-') || MESSAGES_EXACT.has(model)
}

export function zenProtocolForModel(model: string): ZenProtocol {
  if (model.startsWith('jev-')) return 'systemone'
  if (isZenMessagesModel(model)) return 'messages'
  if (RESPONSES_PREFIXES.some((p) => model.startsWith(p))) return 'responses'
  return 'chat'
}
