import type { Message } from '../llm/types.js'
import { PromptRegistry } from './PromptRegistry.js'

export class PromptBuilder {
  constructor(private registry: PromptRegistry) {}

  build(templateName: string, variables: Record<string, unknown>): Message {
    const template = this.registry.get(templateName)
    const content = this.interpolate(template, variables)
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
