import { executeReviewPrWorkflow } from '../workflows/definitions/review-pr.ts'
import { loadChains, runChain, type ChainDefinition } from '../workflows/chains.ts'
import type { CommandDescriptor } from './types.ts'
import { userError } from '../core/cliError.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'

/** Built-in workflows keep working alongside project chains. */
const BUILT_INS: Record<string, () => Promise<string>> = {
  'review-pr': executeReviewPrWorkflow,
}

export const command: CommandDescriptor = {
  name: 'workflow',
  description: 'Run a project chain from chains.yaml, or a built-in workflow',
  handler: (args) => workflow(args),
}

/** A malformed chains.yaml fails with a message that names the file, not a parser dump. */
function readChains(): ChainDefinition[] {
  try {
    return loadChains(process.cwd())
  } catch (err) {
    userError(`Could not read chains.yaml: ${err instanceof Error ? err.message : String(err)}`, {
      fix: 'Fix the chains.yaml at the project root.',
    })
  }
}

function listChains(): void {
  const chains = readChains()
  const builtIns = Object.keys(BUILT_INS)
  if (chains.length === 0 && builtIns.length === 0) {
    console.log('No chains or workflows available. Add a chains.yaml at the project root.')
    return
  }
  for (const chain of chains) {
    console.log(`\n  ${chain.name}  (max_rounds: ${chain.maxRounds})`)
    console.log(`    ${chain.steps.map((s) => s.member).join(' → ')}`)
  }
  if (builtIns.length > 0) {
    console.log(`\n  Built-in: ${builtIns.join(', ')}`)
  }
  console.log()
}

export async function workflow(args: string[]): Promise<void> {
  const [name, ...rest] = args

  if (!name) {
    userError('Usage: agenthood workflow <name>', { fix: 'Examples: workflow list, workflow run build "<task>", workflow review-pr' })
    return
  }

  if (name === 'list') {
    listChains()
    return
  }

  if (name === 'run') {
    await runChainCommand(rest)
    return
  }

  const builtIn = BUILT_INS[name]
  if (!builtIn) {
    const chains = readChains().map((c) => c.name)
    userError(`Unknown workflow: "${name}"`, {
      fix: `Available: ${[...chains, ...Object.keys(BUILT_INS)].join(', ') || 'none'}`,
    })
    return
  }

  const output = await builtIn()
  console.log(`\n  ${output}\n`)
}

async function runChainCommand(args: string[]): Promise<void> {
  const [chainName, ...taskParts] = args
  if (!chainName) {
    userError('Usage: agenthood workflow run <chain> "<task>"', { fix: 'Name a chain from chains.yaml.' })
    return
  }

  let chain
  try {
    chain = readChains().find((c) => c.name === chainName)
  } catch (err) {
    userError(`Cannot read chains.yaml: ${err instanceof Error ? err.message : String(err)}`, {
      fix: 'Fix the YAML shape described in docs/architecture/chain-workflows.md.',
    })
    return
  }
  if (!chain) {
    const available = readChains().map((c) => c.name)
    userError(`Unknown chain: "${chainName}"`, { fix: `Available chains: ${available.join(', ') || 'none'}` })
    return
  }

  const task = taskParts.join(' ')
  if (!task) {
    userError('A chain needs a task.', { fix: 'Example: agenthood workflow run build "implement issue #42"' })
    return
  }

  const config = await loadConfigOrExit()
  ApplicationContext.validateConfig(config)
  const app = await ApplicationContext.create(process.cwd(), config)
  app.ctx.source = 'cli'

  const results = await runChain(chain, task, {
    runner: app.runner,
    config,
    context: app.ctx,
  })

  for (const result of results) {
    console.log(`\n=== ${result.member} ===\n${result.output}`)
  }
  await app.runner.flushTraces()
}
