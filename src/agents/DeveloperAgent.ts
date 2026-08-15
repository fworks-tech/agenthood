import { BaseAgent, type BaseAgentOptions } from './base/BaseAgent.ts'
import { buildLorePrompt } from './memberLore.ts'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WriteCodeSkill } from '../tools/code/WriteCodeSkill.ts'
import { RefactorSkill } from '../tools/code/RefactorSkill.ts'
import { ExplainCodeSkill } from '../tools/code/ExplainCodeSkill.ts'
import { SearchCodebaseSkill } from '../tools/code/SearchCodebaseSkill.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import { SubagentTaskSkill } from '../tools/core/SubagentTaskSkill.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { AgentRegistry } from '../core/AgentRegistry.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-builder', 'SKILL.md')

export interface DeveloperAgentOptions extends BaseAgentOptions {
  agentRegistry: AgentRegistry
  /** Opt-in delegation: grants the SubagentTaskSkill so the agent can call other agents. */
  canDelegate?: boolean
}

export class DeveloperAgent extends BaseAgent {
  role = 'developer'
  protected tools: ITool[]

  constructor(
    llm: ILLMProvider,
    reasoningLoop: ReActLoop,
    toolRegistry: ToolRegistry,
    options: DeveloperAgentOptions,
  ) {
    super(llm, reasoningLoop, toolRegistry, { residualMemory: options.residualMemory, episodeLearner: options.episodeLearner })
    this.tools = [
      new WriteCodeSkill(),
      new RefactorSkill(),
      new ReadFileSkill(),
      new WriteFileSkill(),
      new SearchCodebaseSkill(),
      new ExplainCodeSkill(),
    ]
    if (options.canDelegate) {
      // Restrict delegation to core agents that are safe to call from DeveloperAgent
      const allowedRoles = ['architect', 'qa', 'reviewer', 'the-oracle']
      this.tools.push(new SubagentTaskSkill(options.agentRegistry, { allowedRoles }))
    }
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return buildLorePrompt(context, 'developer.system', SKILL_PATH, {
      vars: { stack: JSON.stringify(context.project.stack ?? {}) },
    })
  }
}
