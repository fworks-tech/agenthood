/**
 * Available-skills catalog formatting (#528, #556) and the filtering/ordering
 * rules that decide what goes in it (#537, #538, #611).
 *
 * The catalog is Tier 1 of progressive disclosure (#512): name and description
 * only: ~50-100 tokens per skill. Bodies load on activation.
 */

import { escapeXml } from '../../agents/memberLore.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'

export type CatalogFormat = 'xml' | 'json' | 'text'

export interface CatalogOptions {
  format?: CatalogFormat
  /** Skills the user disabled in config: filtered and not activatable (#537). */
  disabled?: ReadonlySet<string>
}

const ANTHROPIC = new Set(['anthropic', 'claude'])
const OPENAI = new Set(['openai', 'groq', 'opencode', 'opencode-go', 'azure', 'together', 'mistral'])
const GOOGLE = new Set(['google', 'gemini', 'vertex'])

/**
 * XML is the default because it is what the agentskills spec and the original
 * prompt used; JSON is what OpenAI-family models parse most reliably; plaintext
 * is the fallback for everything else and reads fine in any model.
 */
export function defaultCatalogFormat(provider?: string): CatalogFormat {
  const name = (provider ?? '').toLowerCase()
  if (ANTHROPIC.has(name)) return 'xml'
  if (OPENAI.has(name)) return 'json'
  if (GOOGLE.has(name)) return 'text'
  return 'xml'
}

/**
 * Priority orders the catalog; specificity breaks ties. A longer description
 * names more constraints, so it is the closest local proxy for "more specific
 * to this task" until the model itself decides.
 */
export function orderSkills(manifests: ISkillManifest[]): ISkillManifest[] {
  return [...manifests].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      (b.description?.length ?? 0) - (a.description?.length ?? 0) ||
      a.name.localeCompare(b.name),
  )
}

/** Why a skill is not in the catalog, or undefined when it is listed. */
export function filterReason(manifest: ISkillManifest, disabled?: ReadonlySet<string>): string | undefined {
  if (disabled?.has(manifest.name)) return 'disabled in config'
  if (manifest.hidden) return 'hidden: true'
  if (manifest.disableModelInvocation) return 'disable-model-invocation'
  return undefined
}

/**
 * Render the catalog, or `''` when nothing is listable. An empty
 * `<available_skills/>` invites the model to invent skills (#538), so the
 * caller omits the whole prompt section instead.
 */
export function formatSkillCatalog(manifests: ISkillManifest[], options: CatalogOptions = {}): string {
  const listed = orderSkills(manifests.filter((m) => filterReason(m, options.disabled) === undefined))
  if (listed.length === 0) return ''

  const format = options.format ?? 'xml'
  if (format === 'json') {
    return JSON.stringify(
      listed.map((m) => ({ name: m.name, description: m.description, location: m.location })),
      null,
      2,
    )
  }
  if (format === 'text') {
    return listed.map((m) => `- ${m.name}: ${m.description}`).join('\n')
  }

  const lines = ['<available_skills>']
  for (const m of listed) {
    lines.push(`  <skill name="${escapeXml(m.name)}">`)
    lines.push(`    <description>${escapeXml(m.description)}</description>`)
    lines.push(`    <location>${escapeXml(m.location)}</location>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  return lines.join('\n')
}
