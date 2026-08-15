import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseAgent, type BaseAgentOptions } from './base/BaseAgent.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'
import { buildLorePrompt } from './memberLore.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-reviewer', 'SKILL.md')

export class ReviewerAgent extends BaseAgent {
  role = 'reviewer'
  protected tools: ITool[]

  constructor(llm: ILLMProvider, reasoningLoop: ReActLoop, toolRegistry: ToolRegistry, options: BaseAgentOptions = {}) {
    super(llm, reasoningLoop, toolRegistry, { residualMemory: options.residualMemory, episodeLearner: options.episodeLearner })
    this.tools = [
      new ReadFileSkill(),
    ]
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return buildLorePrompt(context, 'reviewer.system', SKILL_PATH)
  }
}
