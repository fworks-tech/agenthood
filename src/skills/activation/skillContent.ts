/**
 * Structured wrapping for activated skill content (#535).
 *
 * One formatter for both activation paths — the `activate_skill` tool and an
 * explicit `/skill-name` — so the model, the trace, and the compaction guard
 * all see the same shape. The XML branch keeps the `[SKILL_ACTIVATION]` prefix
 * that `ReActLoop` and `ContextCompressor` detect.
 */

import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import { escapeXml } from '../../agents/memberLore.ts'

export const SKILL_ACTIVATION_PREFIX = '[SKILL_ACTIVATION]'

export type SkillContentFormat = 'xml' | 'json'
export type ActivationTrigger = 'model' | 'explicit' | 'fallback'

export interface FormatSkillOptions {
  format?: SkillContentFormat
  trigger?: ActivationTrigger
  /** ISO timestamp; injectable so tests are deterministic. */
  now?: string
  /** Budget notice or other advisory appended inside the block. */
  notice?: string
  /** Set when the skill was reached through a fallback chain (#613). */
  fallbackFrom?: string
}

/**
 * Name of the skill in an activation block, or undefined for any other tool
 * output. The format may be XML or JSON and attributes follow the name, so this
 * is the one place that parses it (#535).
 */
export function activatedSkillName(content: string): string | undefined {
  if (!content.startsWith(SKILL_ACTIVATION_PREFIX)) return undefined
  const xml = content.match(/<skill_content name="([^"]+)"[^>]*>/)
  const json = content.match(/"name":\s*"([^"]+)"/)
  return xml?.[1] ?? json?.[1]
}

/** Resource listing, one `<file>` per entry (Tier 3, #512). */
function resourcesXml(resources: string[]): string {
  if (resources.length === 0) return ''
  return `\n<bundled_resources>\n${resources.map((r) => `  <file>${escapeXml(r)}</file>`).join('\n')}\n</bundled_resources>`
}

export function formatSkillContent(manifest: ISkillManifest, body: string, options: FormatSkillOptions = {}): string {
  const trigger = options.trigger ?? 'model'
  const activatedAt = options.now ?? new Date().toISOString()
  const format = options.format ?? 'xml'
  const notice = options.notice ? `\n${options.notice}` : ''
  const fallback = options.fallbackFrom ? `\n<skill_fallback from="${escapeXml(options.fallbackFrom)}" />` : ''

  if (format === 'json') {
    const payload = {
      skill: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        directory: manifest.directory,
        resources: manifest.resources,
        trigger,
        activatedAt,
        ...(options.fallbackFrom ? { fallbackFrom: options.fallbackFrom } : {}),
      },
      instructions: body,
      ...(options.notice ? { notice: options.notice } : {}),
    }
    return `${SKILL_ACTIVATION_PREFIX}\n${JSON.stringify(payload, null, 2)}`
  }

  const version = manifest.version ? ` version="${escapeXml(manifest.version)}"` : ''
  return `${SKILL_ACTIVATION_PREFIX}
<skill_content name="${escapeXml(manifest.name)}"${version} trigger="${trigger}" activated_at="${activatedAt}">
${body}${notice}${fallback}
Skill directory: ${manifest.directory}
Relative paths in this skill are relative to the skill directory.${resourcesXml(manifest.resources)}
</skill_content>`
}
