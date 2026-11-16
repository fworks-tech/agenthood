/**
 * One answer to "can this skill run here?" (ADR-037, #549, #552, #553, #554, #571).
 *
 * Every requirement is decided in this one pure function, against an injected
 * availability, so the catalog, the activation tool and `verify` cannot disagree
 * about the same skill. Nothing here reads the environment or calls a provider.
 */

import type { ISkillManifest } from './ISkillManifest.ts'

export interface SkillAvailability {
  provider?: string
  model?: string
  contextWindow?: number
  /** Session tool names. Omitted means unknown — tool requirements then warn, never block. */
  tools?: readonly string[]
}

export interface GateResult {
  /** Names usable here, in input order. */
  active: string[]
  /** Name → why it cannot run here. Out of the catalog and refused at activation. */
  blocked: Map<string, string>
  /** Name → non-blocking gaps, shown inside the activation block. */
  warnings: Map<string, string[]>
}

const K_CONTEXT_RE = /\b(\d+)\s*K\s*\+?\s*(?:token\s+)?context\b/i
const TOKEN_CONTEXT_RE = /\b(\d[\d,]*)\s*tokens?\s+context\b/i

/** `<n>K+ context` / `<n> token context` from `compatibility`, as a fallback only. */
export function contextFromCompatibility(prose: string | undefined): number | undefined {
  if (!prose) return undefined
  const k = K_CONTEXT_RE.exec(prose)
  if (k) return Number(k[1]) * 1000
  const tokens = TOKEN_CONTEXT_RE.exec(prose)
  return tokens ? Number(tokens[1].replace(/,/g, '')) : undefined
}

function matchesAny(value: string, fragments: readonly string[]): boolean {
  const lower = value.toLowerCase()
  return fragments.some((fragment) => lower.includes(fragment.toLowerCase()))
}

/** A required tool is available by exact name, or by `mcp.` prefix. */
function hasTool(required: string, tools: readonly string[]): boolean {
  if (tools.includes(required)) return true
  return required.startsWith('mcp.') && tools.some((tool) => tool.startsWith(`${required}.`))
}

/**
 * Why the model is unsuitable, or undefined. Precedence is exclude > family >
 * provider, and a structured requirement always beats the prose fallback.
 */
function modelReason(manifest: ISkillManifest, availability: SkillAvailability): string | undefined {
  const targets = manifest.modelTargets
  const current = [availability.provider, availability.model].filter(Boolean).join('/')
  const switchAdvice = ' Switch to a compatible model to use it — this run keeps the model it started with.'

  if (availability.model && targets?.exclude && matchesAny(availability.model, targets.exclude)) {
    return `model "${availability.model}" is excluded by this skill (exclude: ${targets.exclude.join(', ')}).${switchAdvice}`
  }
  if (availability.model && targets?.family && !matchesAny(availability.model, targets.family)) {
    return `targets the ${targets.family.join(', ')} family, but the current model is "${availability.model}".${switchAdvice}`
  }
  if (availability.provider && targets?.provider) {
    const wanted = targets.provider.map((p) => p.toLowerCase())
    if (!wanted.includes(availability.provider.toLowerCase())) {
      return `requires provider ${targets.provider.join(', ')}, but this run uses "${availability.provider}".${switchAdvice}`
    }
  }

  const requiredTokens = manifest.requires?.context ?? targets?.minTokens ?? contextFromCompatibility(manifest.compatibility)
  if (requiredTokens && availability.contextWindow !== undefined && availability.contextWindow < requiredTokens) {
    return `needs ${requiredTokens} tokens of context, but ${current || 'this model'} offers ${availability.contextWindow}.${switchAdvice}`
  }
  return undefined
}

/**
 * Tool gaps: unmet required tools block, unmet optional tools warn, and an
 * unknown session tool list warns. The catalog is built before a run's registry
 * exists, so "unknown" must not hide a skill the run could have used.
 */
function toolGaps(
  manifest: ISkillManifest,
  availability: SkillAvailability,
): { blocked: string[]; warned: string[] } {
  const required = manifest.requires?.tools ?? []
  const optional = manifest.requires?.optionalTools ?? []
  const tools = availability.tools
  if (!required.length && !optional.length) return { blocked: [], warned: [] }
  if (!tools) {
    const listed = [...required, ...optional]
    return { blocked: [], warned: [`tool availability is checked when the skill runs: ${listed.join(', ')}`] }
  }
  return {
    blocked: required.filter((tool) => !hasTool(tool, tools)).map((tool) => `requires tool "${tool}", which this run does not have`),
    warned: optional
      .filter((tool) => !hasTool(tool, tools))
      .map((tool) => `optional tool "${tool}" is unavailable — some steps may not work`),
  }
}

export function gateSkills(
  manifests: readonly ISkillManifest[],
  availability: SkillAvailability = {},
): GateResult {
  const byName = new Map(manifests.map((manifest) => [manifest.name, manifest] as const))
  const blocked = new Map<string, string>()
  const warned = new Map<string, string[]>()

  const warn = (name: string, messages: string[]): void => {
    if (messages.length === 0) return
    warned.set(name, [...(warned.get(name) ?? []), ...messages])
  }
  const block = (name: string, reason: string): void => {
    if (!blocked.has(name)) blocked.set(name, reason)
  }

  for (const manifest of manifests) {
    const reason = modelReason(manifest, availability)
    if (reason) {
      block(manifest.name, reason)
      continue
    }
    const gaps = toolGaps(manifest, availability)
    if (gaps.blocked.length > 0) {
      block(manifest.name, gaps.blocked.join('; '))
      continue
    }
    warn(manifest.name, gaps.warned)
  }

  // Dependencies: a required dependency must be present and usable. Resolving
  // once per skill keeps a long chain linear and makes a cycle name its path.
  const resolved = new Map<string, boolean>()
  const resolve = (name: string, stack: string[]): boolean => {
    if (blocked.has(name)) return false
    const done = resolved.get(name)
    if (done !== undefined) return done

    const cycleStart = stack.indexOf(name)
    if (cycleStart !== -1) {
      const cycle = [...stack.slice(cycleStart), name].join(' → ')
      for (const member of stack.slice(cycleStart)) block(member, `dependency cycle: ${cycle}`)
      return false
    }

    const manifest = byName.get(name)
    const required = manifest?.dependencies?.required ?? []
    for (const dependency of required) {
      if (!byName.has(dependency)) {
        block(name, `requires skill "${dependency}", which is not installed`)
        return false
      }
      if (!resolve(dependency, [...stack, name])) {
        block(name, `requires "${dependency}", which cannot run here`)
        return false
      }
    }

    const optional = manifest?.dependencies?.optional ?? []
    warn(
      name,
      optional
        .filter((dependency) => !byName.has(dependency) || blocked.has(dependency))
        .map((dependency) => `optional dependency "${dependency}" is unavailable`),
    )
    resolved.set(name, true)
    return true
  }

  for (const manifest of manifests) resolve(manifest.name, [])

  return {
    active: manifests.filter((manifest) => !blocked.has(manifest.name)).map((manifest) => manifest.name),
    blocked,
    warnings: warned,
  }
}
