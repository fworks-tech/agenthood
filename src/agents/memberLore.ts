import { readFileSync, existsSync } from 'node:fs'
import type { ExecutionContext } from '../core/ExecutionContext.ts'

export function loadMemberLore(skillPath: string): string {
  if (!existsSync(skillPath)) return ''
  const content = readFileSync(skillPath, 'utf-8')
  return content.replace(/^---[\s\S]*?---\n*/, '').trim()
}

/**
 * Assembles the shared member prompt: project conventions and architectural
 * decisions as template vars, then the member's SKILL.md lore appended as a
 * trust-separated block. Vars override the two defaults so agents with a
 * different template vocabulary (e.g. qa.system's testPatterns) can supply
 * their own values.
 */
export async function buildLorePrompt(
  context: ExecutionContext,
  templateKey: string,
  skillPath: string,
  vars: Record<string, string> = {},
): Promise<string> {
  const conventions = await context.memory.project.getConventions()
  const archDecisions = await context.memory.project.getArchitecturalDecisions()

  const template = context.prompts.build(templateKey, {
    conventions: conventions.map((c) => `${c.name}: ${c.value}`).join('\n'),
    archDecisions: archDecisions.join('\n'),
    ...vars,
  })

  const memberLore = loadMemberLore(skillPath)
  return memberLore ? `${template.content}\n\n---\n\n${memberLore}` : template.content
}
