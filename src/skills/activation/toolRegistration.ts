import type { ToolRegistry } from '../../tools/ToolRegistry.ts'
import type { ILLMProvider } from '../../llm/ILLMProvider.ts'
import type { LLMConfig } from '../../llm/types.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import type { SkillAvailability } from '../discovery/gating.ts'
import { ActivateSkillTool } from './ActivateSkillTool.ts'
import { RunSkillScriptTool } from '../execution/RunSkillScriptTool.ts'
import { DEFAULT_OUTPUT_TTL_MS } from '../execution/resultCache.ts'

/**
 * Member runs had the catalog in the prompt but no tool to act on it,
 * `activate_skill` was only registered on the developer agent registry
 * (#529, #531). Activation also authorizes `run_skill_script`, so both tools
 * share the active set (ADR-036), and the same availability gates both
 * (ADR-037).
 */
export function registerActivateTool(
  sReg: ToolRegistry,
  manifests: Map<string, ISkillManifest> | undefined,
  llm: ILLMProvider,
  config: LLMConfig,
  availability: Omit<SkillAvailability, 'contextWindow'> = {},
): ActivateSkillTool | undefined {
  if (!manifests || manifests.size === 0) return undefined
  const activeSkills = new Set<string>()
  const tool = new ActivateSkillTool(manifests, llm.getContextWindow(), {
    disabled: new Set(config.skills?.disabled ?? []),
    fallback: config.skills?.fallback !== false,
    format: config.skills?.catalogFormat === 'json' ? 'json' : 'xml',
    activeSkills,
    autoAllowSkillDirs: config.security?.autoAllowSkillDirs !== false,
    availability: { ...availability, contextWindow: llm.getContextWindow() },
  })
  sReg.register(tool)
  sReg.register(
    new RunSkillScriptTool({
      manifests,
      activeSkills,
      sandbox: config.security?.sandbox === true,
      trustedAuthors: config.security?.trustedAuthors ?? [],
      timeoutMs: config.skills?.scriptTimeoutMs,
      cacheTtlMs: config.skills?.cacheOutputs === true ? config.skills.cacheTtlMs ?? DEFAULT_OUTPUT_TTL_MS : undefined,
    }),
  )
  return tool
}
