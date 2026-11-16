#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildCatalog } from '../src/llm/providers/opencodeCatalog.ts'

const ENDPOINTS = ['https://opencode.ai/zen/v1/models', 'https://opencode.ai/zen/go/v1/models']
const OUT = fileURLToPath(new URL('../src/llm/providers/opencode-catalog.json', import.meta.url))

async function fetchModels(url: string): Promise<unknown[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`)
  const body = (await res.json()) as { data?: unknown[] }
  if (!Array.isArray(body.data)) throw new Error(`GET ${url} returned no data array`)
  return body.data
}

const raw: unknown[] = []
for (const url of ENDPOINTS) raw.push(...(await fetchModels(url)))

const { catalog, skipped } = buildCatalog(raw)
if (catalog.models.length === 0) throw new Error('catalog is empty; refusing to overwrite snapshot')
if (skipped.length > 0) console.warn(`skipped ${skipped.length} invalid entries: ${skipped.join(', ')}`)

const lines = catalog.models.map((model) => `    ${JSON.stringify(model)}`)
writeFileSync(OUT, `{\n  "models": [\n${lines.join(',\n')}\n  ]\n}\n`)
console.log(`synced ${catalog.models.length} OpenCode models to ${OUT}`)
