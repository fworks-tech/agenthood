import type { CommandDescriptor } from './types.ts'
import { MissingApiKeyError } from '../llm/validateApiKeys.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'

function parseFlags(args: string[]): { positional: string[]; providerOverride?: string; shouldDetect: boolean } {
  const positional: string[] = []
  let providerOverride: string | undefined
  let shouldDetect = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && i + 1 < args.length) {
      providerOverride = args[++i]
    } else if (args[i] === '--detect') {
      shouldDetect = true
    } else {
      positional.push(args[i])
    }
  }

  return { positional, providerOverride, shouldDetect }
}

function printUsage(): void {
  console.error('Usage: agenthood run <agent> "<task description>"')
  console.error('  --provider <name>   Override LLM provider (e.g. groq, anthropic, ollama, openrouter)')
  console.error('  --detect            Auto-detect members for this task')
}

async function runDetection(app: ApplicationContext, task: string): Promise<void> {
  const detected = app.detectMembers(task)
  if (detected.length > 0) {
    console.log(`\n🎯 Detected members: ${detected.map((d) => `${d.member} (score: ${d.score})`).join(', ')}\n`)
  } else {
    console.log('\nNo members detected for this task.\n')
  }
}

export const command: CommandDescriptor = {
  name: 'run',
  description: 'Run a Society member (the-scribe, the-reviewer, …)',
  handler: (args) => run(args),
}

export async function run(args: string[]): Promise<void> {
  const { positional, providerOverride, shouldDetect } = parseFlags(args)
  const [agentName, ...taskParts] = positional

  if (!agentName || taskParts.length === 0) {
    printUsage()
    process.exit(1)
  }

  if (providerOverride && !ApplicationContext.knownProviders().includes(providerOverride)) {
    console.error(`Unknown provider: "${providerOverride}"`)
    console.error(`Known providers: ${ApplicationContext.knownProviders().join(', ')}`)
    process.exit(1)
  }

  const config = await loadConfigOrExit(providerOverride)
  const task = taskParts.join(" ")

  try {
    ApplicationContext.validateConfig(config)
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error(`\n${err.message}\n`)
      process.exit(1)
    }
    throw err
  }

  const app = await ApplicationContext.create(process.cwd(), config)
  app.ctx.source = 'cli'

  if (shouldDetect) {
    await runDetection(app, task)
  }

  try {
    const handled = await app.runMember(agentName, task, config)
    if (!handled) {
      await app.runAgent(agentName, task)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Error running "${agentName}": ${msg}`)
    // exitCode (not exit) so piped stderr is not truncated before flush
    process.exitCode = 1
  }

  app.snapshotSocietyGraph()
}
