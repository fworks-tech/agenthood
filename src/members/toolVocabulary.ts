/**
 * src/members/toolVocabulary.ts
 *
 * SKILL.md declares tools with the spec vocabulary (`file.read`, `code.write`),
 * while the ToolRegistry keys tools by their implementation name (`read_file`,
 * `write_code`). The two are related only through this map, so it is the single
 * place that translates a declared tool into the name a tool call carries.
 */

import type { ITool } from '../tools/ITool.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../tools/code/WriteCodeSkill.ts'
import { SearchCodebaseSkill } from '../tools/code/SearchCodebaseSkill.ts'
import { ExplainCodeSkill } from '../tools/code/ExplainCodeSkill.ts'
import { RefactorSkill } from '../tools/code/RefactorSkill.ts'
import { PrSyncSkill } from '../tools/pr/PrSyncSkill.ts'
import { AskHumanTool } from '../tools/human/AskHumanTool.ts'
import { SubagentTaskSkill } from '../tools/core/SubagentTaskSkill.ts'

export const TOOL_VOCABULARY: Record<string, new (...args: never[]) => ITool> = {
  'ask_human': AskHumanTool,
  'file.read': ReadFileSkill,
  'file.write': WriteFileSkill,
  'file.search': SearchCodebaseSkill,
  'code.write': WriteCodeSkill,
  'code.refactor': RefactorSkill,
  'code.explain': ExplainCodeSkill,
  'pr_sync': PrSyncSkill,
  'delegate_task': SubagentTaskSkill,
}

// Derived from the tools themselves so the mapping cannot drift from TOOL_MAP.
// Built at import time, so every tool constructor here must stay cheap and side-effect free.
const REGISTRY_NAME_BY_DECLARED: Record<string, string> = Object.fromEntries(
  Object.entries(TOOL_VOCABULARY).map(([declared, Ctor]) => [declared, new Ctor().name]),
)

/** Declared skill tools → the names tool calls actually carry. Unknown names pass through. */
export function toRegistryToolNames(declared: string[] | undefined): string[] | undefined {
  return declared?.map((name) => REGISTRY_NAME_BY_DECLARED[name] ?? name)
}

/** True when a declared name resolves to a tool, by skill vocabulary or implementation name. */
export function isKnownToolName(name: string): boolean {
  return Object.hasOwn(REGISTRY_NAME_BY_DECLARED, name) || Object.values(REGISTRY_NAME_BY_DECLARED).includes(name)
}
