import type { CommandDescriptor } from './types.ts'
import { MissingApiKeyError } from '../llm/validateApiKeys.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'

export function parseFlags(args: string[]): { positional: string[]; providerOverride?: string; shouldDetect: boolean; resumeFrom?: string } {
  const positional: string[] = []
  let providerOverride: string | undefined
  let shouldDetect = false
  let resumeFrom: string | undefined

  for (let i = 0; i < args.length; i++) {
    // `--` ends flag parsing so a task beginning with `-` (e.g. from the
    // opencode plugin) is always data, never a flag
    if (args[i] === '--') {
      positional.push(...args.slice(i + 1))
      break
    }
    if (args[i] === '--provider' && i + 1 < args.length) {
      providerOverride = args[++i]
    } else if (args[i] === '--detect') {
      shouldDetect = true
    } else if (args[i] === '--resume' && i + 1 < args.length) {
      resumeFrom = args[++i]
    } else {
      positional.push(args[i])
    }
  }

  return { positional, providerOverride, shouldDetect, resumeFrom }
}

function printUsage(): void {
  console.error('Usage: agenthood run <agent> "<task description>"')
  console.error('  --provider <name>   Override LLM provider (e.g. groq, anthropic, ollama, openrouter)')
  console.error('  --detect            Auto-detect members for this task')
  console.error('  --resume <id>       Resume from a checkpoint')
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
  const { positional, providerOverride, shouldDetect, resumeFrom } = parseFlags(args)
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
    const handled = await app.runner.runMember(agentName, task, config, resumeFrom)
    if (!handled) {
      await app.runner.runAgent(agentName, task)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Error running "${agentName}": ${msg}`)
    // exitCode (not exit) so piped stderr is not truncated before flush
    process.exitCode = 1
  }

  app.snapshotSocietyGraph()
}
