import { z } from 'zod'
import snapshot from './opencode-catalog.json' with { type: 'json' }

const priceSide = z.object({
  price: z.number().nonnegative(),
  overrides: z.array(z.unknown()).optional(),
})

const contextOverride = z.object({
  when: z.object({ context: z.object({ gt: z.number().nonnegative() }) }),
  price: z.number().nonnegative(),
})

const rawModel = z.object({
  id: z.string().min(1),
  api: z.record(z.string(), z.unknown()),
  limit: z.object({ context: z.number().positive().optional(), output: z.number().positive().optional() }).optional(),
  cost: z.object({ text: z.object({ input: priceSide, output: priceSide }) }),
})

const catalogModelSchema = z.object({
  id: z.string().min(1),
  apis: z.array(z.string()),
  contextWindow: z.number().positive().optional(),
  outputLimit: z.number().positive().optional(),
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  tiers: z.array(z.object({ above: z.number().nonnegative(), input: z.number().nonnegative(), output: z.number().nonnegative() })),
})

const catalogSchema = z.object({ models: z.array(catalogModelSchema) })

export type CatalogModel = z.infer<typeof catalogModelSchema>
export type OpenCodeCatalog = z.infer<typeof catalogSchema>

function contextOverrides(side: z.infer<typeof priceSide>): z.infer<typeof contextOverride>[] {
  return (side.overrides ?? []).flatMap((o) => {
    const parsed = contextOverride.safeParse(o)
    return parsed.success ? [parsed.data] : []
  })
}

function toCatalogModel(m: z.infer<typeof rawModel>): CatalogModel {
  const { input, output } = m.cost.text
  const inputOverrides = contextOverrides(input)
  const outputOverrides = contextOverrides(output)
  const thresholds = [...new Set([...inputOverrides, ...outputOverrides].map((o) => o.when.context.gt))].sort((a, b) => a - b)
  return {
    id: m.id,
    apis: Object.keys(m.api),
    contextWindow: m.limit?.context,
    outputLimit: m.limit?.output,
    input: input.price,
    output: output.price,
    tiers: thresholds.map((above) => ({
      above,
      input: inputOverrides.find((o) => o.when.context.gt === above)?.price ?? input.price,
      output: outputOverrides.find((o) => o.when.context.gt === above)?.price ?? output.price,
    })),
  }
}

/** Earlier entries win on duplicate ids, so pass the primary endpoint first. */
export function buildCatalog(rawModels: unknown[]): { catalog: OpenCodeCatalog; skipped: string[] } {
  const byId = new Map<string, CatalogModel>()
  const skipped: string[] = []
  for (const raw of rawModels) {
    const parsed = rawModel.safeParse(raw)
    if (!parsed.success) {
      skipped.push(typeof raw === 'object' && raw !== null ? String((raw as { id?: unknown }).id) : 'invalid')
      continue
    }
    if (!byId.has(parsed.data.id)) byId.set(parsed.data.id, toCatalogModel(parsed.data))
  }
  const models = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
  return { catalog: catalogSchema.parse({ models }), skipped }
}

const bundled = catalogSchema.parse(snapshot)
const modelsById = new Map(bundled.models.map((m) => [m.id, m]))

export function getCatalogModel(model: string): CatalogModel | undefined {
  return modelsById.get(model.trim().toLowerCase().replace(/^opencode\//, ''))
}

export function getBundledCatalog(): OpenCodeCatalog {
  return bundled
}
