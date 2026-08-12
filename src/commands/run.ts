import type { CommandDescriptor } from "./types.js"
import { join } from "node:path"
import { readFile } from "node:fs/promises"
import { LLMRouter } from "../llm/LLMRouter.ts"
import { validateApiKeys, MissingApiKeyError } from "../llm/validateApiKeys.ts"
import type { LLMConfig, ProviderEntry } from "../llm/types.ts"
import { GraphSnapshot } from "../memory/GraphSnapshot.ts"
import { MemberOrchestrator } from "../reasoning/MemberOrchestrator.ts"
import { ApplicationContext } from "../runtime/ApplicationContext.ts"

async function loadConfig(providerOverride?: string): Promise<LLMConfig> {
  const configPath = join(process.cwd(), '.agenthood', 'config.json')
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  } catch (err) {
    if (err instanceof SyntaxError) {
      // corrupt config must not silently fall back to defaults
      console.error(`Invalid JSON in ${configPath}: ${(err as Error).message}`)
      process.exit(1)
    }
    return providerOverride ? { provider: providerOverride } : {}
  }
  const cfg: LLMConfig = {}

  if (raw.provider) {
    if (typeof raw.provider === 'string') {
      cfg.provider = raw.provider
    } else {
      const providerBlock = raw.provider as { name?: string; model?: string }
      cfg.provider = providerBlock.name
      cfg.model = providerBlock.model
    }
  }

  if (Array.isArray(raw.providers)) {
    const entries: ProviderEntry[] = []
    for (const p of raw.providers) {
      if (p.name) {
        entries.push({
          name: p.name,
          model: p.model,
          apiKey: p.apiKey,
          baseUrl: p.baseUrl,
          models: p.models,
          priority: p.priority,
        })
      }
    }
    if (entries.length > 0) cfg.providers = entries
  }

  if (raw.failover) {
    const failover = raw.failover as { failureThreshold?: number; cooldownMs?: number; probeEnabled?: boolean }
    cfg.failureThreshold = failover.failureThreshold
    cfg.cooldownMs = failover.cooldownMs
    cfg.probeEnabled = failover.probeEnabled
  }

  if (raw.skills) {
    const skills = raw.skills as { autoDiscover?: boolean }
    cfg.skills = { autoDiscover: skills.autoDiscover === true }
  }

  if (providerOverride) {
    cfg.provider = providerOverride
  }

  return cfg
}

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

async function runDetection(task: string): Promise<void> {
  const orchestrator = new MemberOrchestrator()
  const detected = orchestrator.detectMembers({
    userMessage: task,
    changedFiles: [],
    currentStage: undefined,
  })
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

const KNOWN_PROVIDERS = LLMRouter.knownProviders()

export async function run(args: string[]): Promise<void> {
  const { positional, providerOverride, shouldDetect } = parseFlags(args)
  const [agentName, ...taskParts] = positional

  if (!agentName || taskParts.length === 0) {
    printUsage()
    process.exit(1)
  }

  if (providerOverride && !KNOWN_PROVIDERS.includes(providerOverride)) {
    console.error(`Unknown provider: "${providerOverride}"`)
    console.error(`Known providers: ${KNOWN_PROVIDERS.join(', ')}`)
    process.exit(1)
  }

  const config = await loadConfig(providerOverride)
  const task = taskParts.join(" ")

  try {
    validateApiKeys(config)
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error(`\n${err.message}\n`)
      process.exit(1)
    }
    throw err
  }

  const app = await ApplicationContext.create(process.cwd(), config)

  if (shouldDetect) {
    await runDetection(task)
  }

  const handled = await app.runMember(agentName, task, config)
  if (!handled) {
    await app.runAgent(agentName, task)
  }

  try {
    new GraphSnapshot({ snapshotsDir: join(process.cwd(), '.agenthood', 'snapshots') }).take(app.societyGraph)
  } catch (err) {
    console.warn(`[run] society graph snapshot unavailable: ${(err as Error)?.message ?? err}`)
  }
}
