import type { ExecutionContext } from '../core/ExecutionContext.ts'

/** Reason the active skills' scope forbids this tool, or undefined when allowed (ADR-032). */
export function deniedBySkillScope(
  toolName: string,
  activatedSkills: Set<string>,
  context: ExecutionContext,
): string | undefined {
  if (toolName === 'activate_skill') return undefined
  let allowed: Set<string> | undefined
  for (const skill of activatedSkills) {
    const tools = context.skillAllowedTools?.(skill)
    if (!tools) continue
    allowed = allowed ? new Set([...allowed].filter((tool) => tools.includes(tool))) : new Set(tools)
  }
  if (!allowed || allowed.has(toolName)) return undefined
  const names = [...allowed].join(', ') || '(none)'
  return `Tool "${toolName}" is not declared by the active skill (${[...activatedSkills].join(', ')}). Allowed: ${names}`
}
