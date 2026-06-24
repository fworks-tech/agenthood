import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { PromptBuilder } from "../prompts/PromptBuilder.ts"
import { PromptRegistry } from "../prompts/PromptRegistry.ts"
import { LLMRouter } from "../llm/LLMRouter.ts"
import { SkillRegistry } from "../skills/SkillRegistry.ts"
import { ReActLoop } from "../reasoning/ReActLoop.ts"
import { AgentRegistry } from "../core/AgentRegistry.ts"
import { DeveloperAgent } from "../agents/DeveloperAgent.ts"
import { ArchitectAgent } from "../agents/ArchitectAgent.ts"
import { ReviewerAgent } from "../agents/ReviewerAgent.ts"
import { QAAgent } from "../agents/QAAgent.ts"
import { MemberRegistry, MemberAgent } from "../members/index.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { LLMConfig, ProviderEntry } from "../llm/types.ts"

const agentRegistry = new AgentRegistry()
const memberRegistry = new MemberRegistry()

async function loadConfig(providerOverride?: string): Promise<LLMConfig> {
  const configPath = join(process.cwd(), '.agenthood', 'config.json')
  try {
    const raw = JSON.parse(await readFile(configPath, 'utf8'))
    const cfg: LLMConfig = {}

    if (raw.provider) {
      if (typeof raw.provider === 'string') {
        cfg.provider = raw.provider
      } else {
        cfg.provider = raw.provider.name
        cfg.model = raw.provider.model
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
      cfg.failureThreshold = raw.failover.failureThreshold
      cfg.cooldownMs = raw.failover.cooldownMs
      cfg.probeEnabled = raw.failover.probeEnabled
    }

    if (providerOverride) {
      cfg.provider = providerOverride
    }

    return cfg
  } catch {
    return providerOverride ? { provider: providerOverride } : {}
  }
}

function parseFlags(args: string[]): { flags: string[]; positional: string[]; providerOverride?: string } {
  const flags: string[] = []
  const positional: string[] = []
  let providerOverride: string | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && i + 1 < args.length) {
      providerOverride = args[++i]
    } else {
      positional.push(args[i])
    }
  }

  return { flags, positional, providerOverride }
}

async function createContext(projectPath: string, config: LLMConfig): Promise<ExecutionContext> {
  const llm = await LLMRouter.create(config)
  const sReg = new SkillRegistry()
  const loop = new ReActLoop(llm, sReg)

  const dev = new DeveloperAgent(llm, loop, sReg, agentRegistry)
  agentRegistry.register(dev)
  agentRegistry.register(new ArchitectAgent(llm, loop, sReg))
  agentRegistry.register(new ReviewerAgent(llm, loop, sReg))
  agentRegistry.register(new QAAgent(llm, loop, sReg))

  return {
    executionId: randomUUID(),
    project: {
      localPath: projectPath,
      name: projectPath.split(/[/\\]/).pop() ?? "project",
    },
    memory: {
      shortTerm: { add: () => {}, getRecent: () => [], clear: () => {} },
      longTerm: { store: async () => {}, retrieve: async () => null },
      episodic: { record: async () => {}, recall: async () => [] },
      project: {
        getConventions: async () => [],
        getArchitecturalDecisions: async () => [],
      },
    },
    llm,
    prompts: new PromptBuilder(new PromptRegistry()),
    tracer: { startSpan: () => {}, endSpan: () => {} },
    artifacts: [],
  }
}

function validateApiKeys(config: LLMConfig): void {
  const providers = config.providers?.map((p) => p.name) ?? (config.provider ? [config.provider] : ['groq', 'openai', 'anthropic'])
  const needsKey = new Map<string, string>([
    ['groq', 'GROQ_API_KEY'],
    ['openai', 'OPENAI_API_KEY'],
    ['anthropic', 'ANTHROPIC_API_KEY'],
  ])

  const missing: string[] = []
  for (const name of providers) {
    const envVar = needsKey.get(name)
    if (envVar && !process.env[envVar]) {
      missing.push(envVar)
    }
  }

  if (missing.length === providers.length) {
    console.error('')
    console.error('No LLM provider API keys found. Set at least one:')
    console.error('  $env:GROQ_API_KEY = "your-key"        (free tier available)')
    console.error('  $env:OPENAI_API_KEY = "your-key"')
    console.error('  $env:ANTHROPIC_API_KEY = "your-key"')
    console.error('')
    console.error('Or run Ollama locally for offline execution (no key needed).')
    console.error('')
    process.exit(1)
  }
}

export async function run(args: string[]): Promise<void> {
  const { positional, providerOverride } = parseFlags(args)
  const [agentName, ...taskParts] = positional

  if (!agentName || taskParts.length === 0) {
    console.error('Usage: agenthood run <agent> "<task description>"')
    console.error('  --provider <name>   Override LLM provider (e.g. groq, anthropic, ollama)')
    process.exit(1)
  }

  const config = await loadConfig(providerOverride)
  validateApiKeys(config)
  const context = await createContext(process.cwd(), config)
  const task = taskParts.join(" ")

  // Try Society member first (14 named members)
  if (memberRegistry.has(agentName)) {
    const spec = memberRegistry.get(agentName)
    const llm = await LLMRouter.createForMember(spec.preferredProvider, config)
    const sReg = new SkillRegistry()
    const loop = new ReActLoop(llm, sReg)
    const agent = new MemberAgent(spec, llm, loop, sReg)

    try {
      const result = await agent.run(task, context)
      console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Error running member "${agentName}": ${msg}`)
      process.exit(1)
    }
  }

  // Fall back to generic template agents (developer, architect, reviewer, qa)
  try {
    const agent = agentRegistry.get(agentName)
    const result = await agent.run(task, context)
    console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Error running agent "${agentName}": ${msg}`)
    process.exit(1)
  }
}
