import type { ISkill } from './ISkill.js'
import type { ToolSchema } from '../llm/types.js'

export class SkillNotFoundError extends Error {
  constructor(skillName: string) {
    super(`Skill not found: "${skillName}"`)
    this.name = 'SkillNotFoundError'
  }
}

export class SkillRegistry {
  private skills = new Map<string, ISkill>()

  register(skill: ISkill): void {
    this.skills.set(skill.name, skill)
  }

  get(name: string): ISkill {
    const skill = this.skills.get(name)
    if (!skill) {
      throw new SkillNotFoundError(name)
    }
    return skill
  }

  getSchemas(): ToolSchema[] {
    const schemas: ToolSchema[] = []
    for (const skill of this.skills.values()) {
      schemas.push({
        name: skill.name,
        description: skill.description,
        inputSchema: skill.inputSchema,
      })
    }
    return schemas
  }

  has(name: string): boolean {
    return this.skills.has(name)
  }

  list(): ISkill[] {
    return Array.from(this.skills.values())
  }
}
