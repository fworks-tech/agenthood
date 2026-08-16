import type { BaseAgent } from '../agents/base/BaseAgent.ts'

export class AgentNotFoundError extends Error {
  constructor(role: string) {
    super(`Agent not found: "${role}"`)
    this.name = 'AgentNotFoundError'
  }
}

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>()

  register(agent: BaseAgent): void {
    this.agents.set(agent.role, agent)
  }

  get(role: string): BaseAgent {
    const agent = this.agents.get(role)
    if (!agent) {
      throw new AgentNotFoundError(role)
    }
    return agent
  }

  has(role: string): boolean {
    return this.agents.has(role)
  }
}
