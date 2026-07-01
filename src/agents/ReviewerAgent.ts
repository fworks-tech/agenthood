import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseAgent } from './base/BaseAgent.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-reviewer', 'SKILL.md')

function loadMemberLore(): string {
  if (!existsSync(SKILL_PATH)) return ''
  const content = readFileSync(SKILL_PATH, 'utf-8')
  return content.replace(/^---[\s\S]*?---\n*/, '').trim()
}

export class ReviewerAgent extends BaseAgent {
  role = 'reviewer'
  protected tools: ITool[]

  constructor(llm: ILLMProvider, reasoningLoop: ReActLoop, toolRegistry: ToolRegistry) {
    super(llm, reasoningLoop, toolRegistry)
    this.tools = [
      new ReadFileSkill(),
      new WriteFileSkill(),
    ]
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions()
    const archDecisions = await context.memory.project.getArchitecturalDecisions()

    const template = context.prompts.build('reviewer.system', {
      conventions: conventions.map((c) => `${c.name}: ${c.value}`).join('\n'),
      archDecisions: archDecisions.join('\n'),
    })

    const memberLore = loadMemberLore()
    return memberLore ? `${template.content}\n\n---\n\n${memberLore}` : template.content
  }
}
