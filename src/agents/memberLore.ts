import { readFileSync, existsSync } from 'node:fs'
import type { ExecutionContext } from '../core/ExecutionContext.ts'

export function loadMemberLore(skillPath: string): string {
  if (!existsSync(skillPath)) return ''
  const content = readFileSync(skillPath, 'utf-8')
  return content.replace(/^---[\s\S]*?---\n*/, '').trim()
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function wrapProjectContext(text: string): string {
  return `<project_context>\n${text}\n</project_context>`
}

/**
 * Assembles the shared member prompt: project conventions and architectural
 * decisions as template vars, then the member's SKILL.md lore appended as a
 * trust-separated block. Vars override the two defaults so agents with a
 * different template vocabulary (e.g. qa.system's testPatterns) can supply
 * their own values. Convention and ADR content originates from the project
 * repo, so it is wrapped in a project_context trust boundary — it must read
 * as data, not instructions.
 */
export async function buildLorePrompt(
  context: ExecutionContext,
  templateKey: string,
  skillPath: string,
  vars: Record<string, string> = {},
): Promise<string> {
  const conventions = await context.memory.project.getConventions()
  const archDecisions = await context.memory.project.getArchitecturalDecisions()

  const wrappedVars: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars)) {
    wrappedVars[key] = wrapProjectContext(value)
  }

  const template = context.prompts.build(templateKey, {
    conventions: wrapProjectContext(conventions.map((c) => `${c.name}: ${c.value}`).join('\n')),
    archDecisions: wrapProjectContext(archDecisions.join('\n')),
    ...wrappedVars,
  })

  const memberLore = loadMemberLore(skillPath)
  return memberLore ? `${template.content}\n\n---\n\n${memberLore}` : template.content
}
