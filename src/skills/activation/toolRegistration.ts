import type { ToolRegistry } from '../../tools/ToolRegistry.ts'
import type { ILLMProvider } from '../../llm/ILLMProvider.ts'
import type { LLMConfig } from '../../llm/types.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import { ActivateSkillTool } from './ActivateSkillTool.ts'

/**
 * Member runs had the catalog in the prompt but no tool to act on it —
 * `activate_skill` was only registered on the developer agent registry
 * (#529, #531).
 */
export function registerActivateTool(
  sReg: ToolRegistry,
  manifests: Map<string, ISkillManifest> | undefined,
  llm: ILLMProvider,
  config: LLMConfig,
): ActivateSkillTool | undefined {
  if (!manifests || manifests.size === 0) return undefined
  const tool = new ActivateSkillTool(manifests, llm.getContextWindow(), {
    disabled: new Set(config.skills?.disabled ?? []),
    fallback: config.skills?.fallback !== false,
    format: config.skills?.catalogFormat === 'json' ? 'json' : 'xml',
  })
  sReg.register(tool)
  return tool
}
