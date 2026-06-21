import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BaseAgent } from './base/BaseAgent.ts'
import { ReadFileSkill } from '../skills/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../skills/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../skills/code/WriteCodeSkill.ts'
import type { ISkill } from '../skills/ISkill.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { SkillRegistry } from '../skills/SkillRegistry.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SKILL_PATH = join(__dirname, '..', '..', 'members', 'the-architect', 'SKILL.md')

function loadMemberLore(): string {
  if (!existsSync(SKILL_PATH)) return ''
  const content = readFileSync(SKILL_PATH, 'utf-8')
  return content.replace(/^---[\s\S]*?---\n*/, '').trim()
}

export class ArchitectAgent extends BaseAgent {
  role = 'architect'
  protected skills: ISkill[]

  constructor(llm: ILLMProvider, reasoningLoop: ReActLoop, skillRegistry: SkillRegistry) {
    super(llm, reasoningLoop, skillRegistry)
    this.skills = [
      new ReadFileSkill(),
      new WriteFileSkill(),
      new WriteCodeSkill(),
    ]
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions()
    const archDecisions = await context.memory.project.getArchitecturalDecisions()
    const stack = context.project.stack

    const template = context.prompts.build('architect.system', {
      conventions: conventions.map((c) => `${c.name}: ${c.value}`).join('\n'),
      archDecisions: archDecisions.join('\n'),
      stack: JSON.stringify(stack ?? {}),
    })

    const memberLore = loadMemberLore()
    return memberLore ? `${template.content}\n\n---\n\n${memberLore}` : template.content
  }
}
