import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseAgent } from './base/BaseAgent.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../tools/code/WriteCodeSkill.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'
import { loadMemberLore } from './memberLore.ts'
import type { EpisodeLearner } from '../evals/EpisodeLearner.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-tester', 'SKILL.md')

export class QAAgent extends BaseAgent {
  role = 'qa'
  protected tools: ITool[]

  constructor(llm: ILLMProvider, reasoningLoop: ReActLoop, toolRegistry: ToolRegistry, episodeLearner?: EpisodeLearner) {
    super(llm, reasoningLoop, toolRegistry, { episodeLearner })
    this.tools = [
      new ReadFileSkill(),
      new WriteFileSkill(),
      new WriteCodeSkill(),
    ]
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions()
    const archDecisions = await context.memory.project.getArchitecturalDecisions()
    const stack = context.project.stack

    const template = context.prompts.build('qa.system', {
      conventions: conventions.map((c) => `${c.name}: ${c.value}`).join('\n'),
      testPatterns: archDecisions.join('\n'),
      stack: JSON.stringify(stack ?? {}),
    })

    const memberLore = loadMemberLore(SKILL_PATH)
    return memberLore ? `${template.content}\n\n---\n\n${memberLore}` : template.content
  }
}
