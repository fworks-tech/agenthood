import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseAgent, type BaseAgentOptions } from './base/BaseAgent.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../tools/code/WriteCodeSkill.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'
import { buildLorePrompt } from './memberLore.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-architect', 'SKILL.md')

export class ArchitectAgent extends BaseAgent {
  role = 'architect'
  protected tools: ITool[]

  constructor(llm: ILLMProvider, reasoningLoop: ReActLoop, toolRegistry: ToolRegistry, options: BaseAgentOptions = {}) {
    super(llm, reasoningLoop, toolRegistry, { episodeLearner: options.episodeLearner })
    this.tools = [
      new ReadFileSkill(),
      new WriteFileSkill(),
      new WriteCodeSkill(),
    ]
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return buildLorePrompt(context, 'architect.system', SKILL_PATH, {
      stack: JSON.stringify(context.project.stack ?? {}),
    })
  }
}
