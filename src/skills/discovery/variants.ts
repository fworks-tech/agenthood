/**
 * Model-specific bodies (#551). A variant is a markdown file inside the skill
 * directory; the longest model-id fragment wins, and anything that cannot be
 * resolved falls back to the default body with a warning rather than failing an
 * activation the model already committed to.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { ISkillManifest } from './ISkillManifest.ts'

export interface VariantSelection {
  body: string
  /** The fragment that matched, when a variant was used. */
  variant?: string
  warning?: string
}

/** The longest `metadata.variants` key contained in the model id. */
export function pickVariantKey(variants: Record<string, string>, model: string): string | undefined {
  const lower = model.toLowerCase()
  return Object.keys(variants)
    .filter((fragment) => fragment.trim() !== '' && lower.includes(fragment.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0]
}

/** Resolves a variant path and reports whether it stays inside the skill directory. */
export function variantTarget(directory: string, path: string): { path: string; inside: boolean } {
  const root = resolve(directory)
  const target = resolve(root, path)
  return { path: target, inside: target === root || target.startsWith(root + sep) }
}

export function selectVariantBody(manifest: ISkillManifest, model?: string): VariantSelection {
  const variants = manifest.variants
  if (!variants || !model) return { body: manifest.body }

  const key = pickVariantKey(variants, model)
  if (!key) return { body: manifest.body }

  const { path, inside } = variantTarget(manifest.directory, variants[key])
  if (!inside) {
    return { body: manifest.body, warning: `variant "${key}" points outside the skill directory; using the default body` }
  }
  if (!existsSync(path)) {
    return { body: manifest.body, warning: `variant "${key}" (${variants[key]}) not found; using the default body` }
  }
  try {
    const body = readFileSync(path, 'utf8').trim()
    if (body === '') return { body: manifest.body, warning: `variant "${key}" is empty; using the default body` }
    return { body, variant: key }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { body: manifest.body, warning: `variant "${key}" could not be read (${message}); using the default body` }
  }
}
