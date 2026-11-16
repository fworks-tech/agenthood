/**
 * Relative references in a SKILL.md body (#542). The body addresses its own
 * files from the skill directory, so `/`-less prose stays prose and every
 * resolved target must remain inside that directory.
 */

import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g
const CODE_SPAN = /`([^`\n]+)`/g
const PATH_LIKE = /^(?:\.\/)?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.@-]+)+$|^(?:\.\/)?[A-Za-z0-9_.-]+\.(?:md|py|sh|ts|js|json|ya?ml|txt)$/
const EXTERNAL = /^(?:https?:|mailto:|#|\/)/

function candidates(body: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(MARKDOWN_LINK)) {
    if (!EXTERNAL.test(match[1])) found.add(match[1])
  }
  for (const match of body.matchAll(CODE_SPAN)) {
    const value = match[1].trim()
    if (PATH_LIKE.test(value)) found.add(value)
  }
  return [...found]
}

/**
 * Paths the body points at that do not exist. A missing target is a warning,
 * not a failure: a skill may reference a file its script creates at run time.
 */
export function findMissingReferences(body: string, directory: string): string[] {
  return candidates(body).filter((reference) => {
    const target = resolve(directory, reference)
    const inside = target === resolve(directory) || target.startsWith(resolve(directory) + sep)
    return inside && !existsSync(target)
  })
}

/** True when a reference resolves outside the skill directory: never allowed. */
export function escapesSkillDirectory(reference: string, directory: string): boolean {
  const root = resolve(directory)
  const target = resolve(root, reference)
  return target !== root && !target.startsWith(root + sep)
}
