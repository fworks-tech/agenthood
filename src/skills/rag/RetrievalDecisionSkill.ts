import type { ISkill, SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { JSONSchema } from '../../llm/types.js'

type RetrievalStrategy = 'skip' | 'vector' | 'graph' | 'both'

export type { RetrievalStrategy }

export class RetrievalDecisionSkill implements ISkill {
  name = 'decide_retrieval'
  description = 'Decide whether to retrieve context before answering. Returns: skip | vector | graph | both'

  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The user query to evaluate' },
    },
    required: ['query'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { query } = input as { query: string }

    const decision = this.decide(query, context)

    return {
      success: true,
      output: decision,
    }
  }

  decide(query: string, context: ExecutionContext): RetrievalStrategy {
    const lowerQuery = query.toLowerCase()

    if (this.isAnswerableFromSTM(query, context)) {
      return 'skip'
    }

    const graphRoots = ['depend', 'call', 'import', 'extend', 'implement', 'relat',
      'connect', 'neighbor', 'referenc', 'affect', 'us', 'use']
    const vectorRoots = ['what ', 'explain', 'describe', 'summariz', 'mean',
      'concept', 'purpose', 'overview', 'differ', 'how ']

    const hasGraph = graphRoots.some((k) => lowerQuery.includes(k))
    const hasVector = vectorRoots.some((k) => lowerQuery.includes(k))

    if (hasGraph && hasVector) return 'both'
    if (hasGraph) return 'graph'
    if (hasVector) return 'vector'

    return 'vector'
  }

  private isAnswerableFromSTM(query: string, context: ExecutionContext): boolean {
    const memory = context.memory?.shortTerm
    if (!memory) return false

    const recent = memory.getRecent(5)
    if (recent.length === 0) return false

    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    if (words.length === 0) return false

    for (const entry of recent) {
      const lowerEntry = entry.toLowerCase()
      if (words.some((w) => lowerEntry.includes(w))) {
        return true
      }
    }

    return false
  }
}
