import { DiffImpactAnalyzer } from '../DiffImpactAnalyzer.js'
import { QualityGates } from '../QualityGates.js'
import { WorkflowEngine } from '../WorkflowEngine.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { IProtocol } from '../protocols/IProtocol.js'
import type { WorkflowDefinition, WorkflowStep } from '../types.js'

class ImpactProtocol implements IProtocol<unknown, unknown> {
  name = 'impact-protocol'
  config = { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 30000 }

  async execute(): Promise<unknown> {
    return new DiffImpactAnalyzer().analyze()
  }

  onFailure(_error: Error, _attempt: number): 'retry' | 'abort' | 'escalate' {
    return 'abort'
  }
}

class QualityGatesProtocol implements IProtocol<unknown, unknown> {
  name = 'gates-protocol'
  config = { retryPolicy: { maxRetries: 0, backoffMs: 0 }, timeoutMs: 120000 }

  async execute(): Promise<unknown> {
    return new QualityGates().check()
  }

  onFailure(_error: Error, _attempt: number): 'retry' | 'abort' | 'escalate' {
    return 'abort'
  }
}

export function createReviewPrWorkflow(): { definition: WorkflowDefinition; protocols: IProtocol<unknown, unknown>[] } {
  const impactProtocol = new ImpactProtocol()
  const gatesProtocol = new QualityGatesProtocol()

  const steps: WorkflowStep[] = [
    {
      name: 'analyze-impact',
      type: 'tool',
      protocol: impactProtocol,
      task: 'Analyze git diff impact',
    },
    {
      name: 'quality-gates',
      type: 'tool',
      protocol: gatesProtocol,
      task: 'Run quality checks',
    },
    {
      name: 'code-review',
      type: 'agent',
      agentName: 'the-reviewer',
      task: 'Review code changes for correctness, security, and maintainability',
    },
    {
      name: 'human-approval',
      type: 'human-in-loop',
      task: 'Review the analysis and approve or request changes',
    },
  ]

  return {
    definition: {
      name: 'review-pr',
      description: 'Full PR review workflow: impact analysis, quality gates, code review, and human approval',
      steps,
    },
    protocols: [impactProtocol, gatesProtocol],
  }
}

function formatReport(impact: ReturnType<DiffImpactAnalyzer['analyze']>, gates: ReturnType<QualityGates['check']>): string {
  const lines: string[] = []
  lines.push('## Impact Analysis')
  lines.push('')
  lines.push(`- Files changed: ${impact.totalFiles}`)
  lines.push(`- Additions: ${impact.totalAdditions}+ / Deletions: ${impact.totalDeletions}-`)
  lines.push(`- Risk level: ${impact.riskLevel}`)
  lines.push(`- Breaking: ${impact.breaking ? 'Yes' : 'No'}`)
  lines.push(`- Affected areas: ${impact.affectedAreas.join(', ') || 'none'}`)
  lines.push(`- Suggested reviewers: ${impact.suggestedReviewers.join(', ')}`)
  lines.push('')
  lines.push('## Quality Gates')
  lines.push('')

  let allGatesPass = true
  for (const gate of gates) {
    const icon = gate.pass ? 'PASS' : 'FAIL'
    lines.push(`- [${icon}] ${gate.name}: ${gate.detail}`)
    if (!gate.pass) allGatesPass = false
  }

  lines.push('')
  lines.push('## Summary')
  lines.push('')
  if (allGatesPass && impact.riskLevel !== 'high') {
    lines.push('All checks passed. Proceed with merge after human review.')
  } else {
    lines.push('Issues detected. Address the failures above before merging.')
  }

  return lines.join('\n')
}

export async function executeReviewPrWorkflow(): Promise<string> {
  const engine = new WorkflowEngine()
  const { definition: workflow, protocols } = createReviewPrWorkflow()
  for (const p of protocols) engine.registerProtocol(p.name, p)

  const context: ExecutionContext = {
    executionId: 'review-pr',
    project: { localPath: process.cwd(), name: 'project' },
    memory: {} as any,
    llm: {} as any,
    prompts: {} as any,
    tracer: { startSpan: () => {}, endSpan: () => {} },
    artifacts: [],
  }

  const wfContext = await engine.execute(workflow, context)

  const impact = wfContext.stepResults.get('analyze-impact') as ReturnType<DiffImpactAnalyzer['analyze']>
  const gates = wfContext.stepResults.get('quality-gates') as ReturnType<QualityGates['check']>

  return formatReport(impact, gates)
}
