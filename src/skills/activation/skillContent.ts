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
import { statSync } from 'node:fs'
import { join } from 'node:path'

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
  /** `--eager` raises the resource listing limit; nothing is read (#543). */
  eager?: boolean
}

/** Resource lines shown by default, and the raised limit with `--eager` (#543). */
export const MAX_RESOURCES = 20
export const MAX_RESOURCES_EAGER = 200

export interface ResourceInfo {
  path: string
  kind: 'script' | 'text' | 'image' | 'file'
  bytes: number
}

function resourceKind(path: string): ResourceInfo['kind'] {
  if (path.startsWith('scripts/')) return 'script'
  if (/\.(?:md|txt)$/i.test(path)) return 'text'
  if (/\.(?:png|jpe?g|gif|svg|webp)$/i.test(path)) return 'image'
  return 'file'
}

/**
 * Metadata only — the listing says how big a resource is so the model can
 * decide whether to read it, and never pays for the contents (#543).
 */
export function describeResources(directory: string, resources: string[], limit = MAX_RESOURCES): ResourceInfo[] {
  return resources.slice(0, limit).map((path) => {
    let bytes = 0
    try {
      bytes = statSync(join(directory, path)).size
    } catch {
      // a resource listed by the parser but removed since — keep the entry
    }
    return { path, kind: resourceKind(path), bytes }
  })
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

/** Resource listing, one `<file>` per entry with metadata only (#512, #543). */
function resourcesXml(entries: ResourceInfo[], total: number): string {
  if (entries.length === 0) return ''
  const lines = entries.map(
    (entry) => `  <file kind="${entry.kind}" bytes="${entry.bytes}">${escapeXml(entry.path)}</file>`,
  )
  const omitted = total > entries.length ? `\n  <more>${total - entries.length} more — activate with eager to list</more>` : ''
  return `\n<bundled_resources>\n${lines.join('\n')}${omitted}\n</bundled_resources>`
}

export function formatSkillContent(manifest: ISkillManifest, body: string, options: FormatSkillOptions = {}): string {
  const trigger = options.trigger ?? 'model'
  const activatedAt = options.now ?? new Date().toISOString()
  const format = options.format ?? 'xml'
  const notice = options.notice ? `\n${options.notice}` : ''
  const fallback = options.fallbackFrom ? `\n<skill_fallback from="${escapeXml(options.fallbackFrom)}" />` : ''
  const limit = options.eager ? MAX_RESOURCES_EAGER : MAX_RESOURCES
  const resources = describeResources(manifest.directory, manifest.resources, limit)

  if (format === 'json') {
    const payload = {
      skill: {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        directory: manifest.directory,
        resources,
        ...(resources.length < manifest.resources.length ? { resourcesTotal: manifest.resources.length } : {}),
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
Relative paths in this skill are relative to the skill directory.${resourcesXml(resources, manifest.resources.length)}
</skill_content>`
}
