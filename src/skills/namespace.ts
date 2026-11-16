/**
 * Skill references: `owner/name`, optionally `@owner/name` on the command line
 * (ADR-035). The local identity of a skill stays flat: the owner is a registry
 * qualifier, never part of the directory or the frontmatter `name`.
 */

export interface SkillRef {
  owner?: string
  name: string
}

/** ASCII only: a registry key must survive URL encoding and case-insensitive filesystems. */
export const OWNER_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Parse a reference, throwing on a malformed one. A bare `name` parses to an
 * ownerless ref so legacy entries keep resolving.
 */
export function parseSkillRef(raw: string): SkillRef {
  const value = raw.startsWith('@') ? raw.slice(1) : raw
  const parts = value.split('/')
  if (parts.length === 1) {
    if (!parts[0]) throw new Error(`empty skill reference: "${raw}"`)
    return { name: parts[0] }
  }
  if (parts.length !== 2) {
    throw new Error(`invalid skill reference "${raw}", expected owner/name`)
  }
  const [owner, name] = parts
  if (!OWNER_RE.test(owner)) {
    throw new Error(`invalid owner "${owner}" in "${raw}", use lowercase letters, digits and single hyphens`)
  }
  if (!name) throw new Error(`missing skill name in "${raw}"`)
  return { owner, name }
}

export function formatSkillRef(ref: SkillRef): string {
  return ref.owner ? `${ref.owner}/${ref.name}` : ref.name
}

/**
 * Path segments for a registry URL, encoded separately so the separator survives.
 * Deliberately lenient: a legacy bare key may contain characters a parsed
 * reference would reject, and it must still resolve.
 */
export function toRegistryPath(raw: string): string {
  const value = raw.startsWith('@') ? raw.slice(1) : raw
  const parts = value.split('/')
  if (parts.length > 2 || parts[0] === '') {
    throw new Error(`invalid skill reference "${raw}", expected owner/name`)
  }
  return parts.map(encodeURIComponent).join('/')
}

/** True when the argument is a reference rather than a URL, git address or path. */
export function isSkillReference(raw: string): boolean {
  if (/[:\\]/.test(raw) || raw.startsWith('.') || raw.startsWith('/')) return false
  const value = raw.startsWith('@') ? raw.slice(1) : raw
  return /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
