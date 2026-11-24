/**
 * src/llm/providers/zenEndpoints.ts
 *
 * OpenCode Zen is not a single API. Each model is served on its own endpoint
 * (https://opencode.ai/docs/zen/#endpoints), and the live `/v1/models` catalog
 * lists those endpoints per model in its `api` field. Routing reads that
 * catalog so the provider never assumes chat for a messages or responses model.
 */

import { getCatalogModel } from './opencodeCatalog.ts'

export type ZenProtocol = 'chat' | 'messages' | 'responses' | 'generate-content' | 'systemone'

const PROTOCOL_PRIORITY: Array<[string, ZenProtocol]> = [
  ['systemone', 'systemone'],
  ['messages', 'messages'],
  ['responses', 'responses'],
  ['chat-completions', 'chat'],
  ['generate-content', 'generate-content'],
]

export function zenProtocolForModel(model: string): ZenProtocol {
  // Jev models are systemone by prefix even if the catalog is missing them.
  if (model.startsWith('jev-')) return 'systemone'
  const apis = getCatalogModel(model)?.apis ?? []
  return PROTOCOL_PRIORITY.find(([api]) => apis.includes(api))?.[1] ?? 'chat'
}

export function isZenMessagesModel(model: string): boolean {
  return zenProtocolForModel(model) === 'messages'
}
