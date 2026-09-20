import { executeReviewPrWorkflow } from '../workflows/definitions/review-pr.ts'
import type { CommandDescriptor } from './types.ts'
import { userError } from '../core/cliError.ts'

const WORKFLOWS: Record<string, () => Promise<string>> = {
  'review-pr': executeReviewPrWorkflow,
}

export const command: CommandDescriptor = {
  name: 'workflow',
  description: 'Execute a workflow (e.g. review-pr)',
  handler: (args) => workflow(args),
}

export async function workflow(args: string[]): Promise<void> {
  const [name] = args

  if (!name || !WORKFLOWS[name]) {
    const available = Object.keys(WORKFLOWS).join(', ')
    userError(`Unknown workflow: "${name ?? ''}"`, { fix: `Available workflows: ${available}` })
    return
  }

  const executor = WORKFLOWS[name]
  const output = await executor()
  console.log(`\n  ${output}\n`)
}
