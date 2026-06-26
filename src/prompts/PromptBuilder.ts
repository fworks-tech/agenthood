import type { Message } from '../llm/types.js'
import { PromptRegistry } from './PromptRegistry.js'
import type { ResidualMemory } from '../memory/ResidualMemory.js'
import type { PersonalisationStore } from '../memory/PersonalisationStore.js'

export class PromptBuilder {
  constructor(
    private registry: PromptRegistry,
    private residualMemory?: ResidualMemory,
    private personalisation?: PersonalisationStore,
  ) {}

  build(templateName: string, variables: Record<string, unknown>): Message {
    const template = this.registry.get(templateName)
    let content = this.interpolate(template, variables)
    if (this.residualMemory) {
      const hints = this.residualMemory.toPromptHints()
      if (hints) {
        content += `\n\n${hints}`
      }
    }
    if (this.personalisation) {
      const ctx = this.personalisation.toPromptContext()
      if (ctx) {
        content += `\n\n${ctx}`
      }
    }
    return { role: 'system', content }
  }

  private interpolate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      if (key in vars) {
        return String(vars[key])
      }
      return `[MISSING: ${key}]`
    })
  }
}
