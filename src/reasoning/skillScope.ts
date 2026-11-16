import type { ExecutionContext } from '../core/ExecutionContext.ts'

const warnedUnresolved = new Set<string>()

/**
 * Reason the active skills' scope forbids this tool, or undefined when allowed (ADR-032).
 * A declared name that matches no registered tool is ignored with a one-time warning,
 * so a skill written for another client still loads; it can never widen the scope.
 */
export function deniedBySkillScope(
  toolName: string,
  activatedSkills: Set<string>,
  context: ExecutionContext,
  isRegistered: (name: string) => boolean,
): string | undefined {
  if (toolName === 'activate_skill') return undefined
  let allowed: Set<string> | undefined
  for (const skill of activatedSkills) {
    const declared = context.skillAllowedTools?.(skill)
    if (!declared) continue
    const tools = declared.filter((tool) => {
      if (isRegistered(tool)) return true
      const key = `${skill}:${tool}`
      if (!warnedUnresolved.has(key)) {
        warnedUnresolved.add(key)
        console.warn(`[skills] ${skill} declares "${tool}", which matches no registered tool — ignored`)
      }
      return false
    })
    allowed = allowed ? new Set([...allowed].filter((tool) => tools.includes(tool))) : new Set(tools)
  }
  if (!allowed || allowed.has(toolName)) return undefined
  const names = [...allowed].join(', ') || '(none)'
  return `Tool "${toolName}" is not declared by the active skill (${[...activatedSkills].join(', ')}). Allowed: ${names}`
}
