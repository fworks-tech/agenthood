import { executeReviewPrWorkflow } from '../workflows/definitions/review-pr.js'
import type { CommandDescriptor } from './types.js'

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
    console.error('Usage: agenthood workflow <name>')
    console.error('Available workflows:')
    for (const key of Object.keys(WORKFLOWS)) {
      console.error(`  - ${key}`)
    }
    process.exit(1)
    return
  }

  const executor = WORKFLOWS[name]
  const output = await executor()
  console.log(`\n  ${output}\n`)
}
