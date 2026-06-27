import { DiffImpactAnalyzer } from '../DiffImpactAnalyzer.js'
import { QualityGates } from '../../core/QualityGates.js'
import type { WorkflowDefinition, WorkflowStep } from '../types.js'
import type { AgentProtocol } from '../protocols/AgentProtocol.js'

export function createReviewPrWorkflow(): WorkflowDefinition {
  const cwd = process.cwd()

  const steps: WorkflowStep[] = [
    {
      name: 'analyze-impact',
      type: 'tool',
      task: 'Analyze git diff impact',
    },
    {
      name: 'quality-gates',
      type: 'tool',
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
    name: 'review-pr',
    description: 'Full PR review workflow: impact analysis, quality gates, code review, and human approval',
    steps,
  }
}

export async function executeReviewPrWorkflow(): Promise<string> {
  const analyzer = new DiffImpactAnalyzer()
  const gates = new QualityGates()

  const impact = analyzer.analyze()

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

  const gateResults = gates.check()
  let allGatesPass = true
  for (const gate of gateResults) {
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
