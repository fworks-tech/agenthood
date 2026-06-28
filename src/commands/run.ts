import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
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
import { OracleAgent } from "../agents/OracleAgent.ts"
import { MemberRegistry, MemberAgent } from "../members/index.ts"
import { validateApiKeys, MissingApiKeyError } from "../llm/validateApiKeys.ts"
import { SocietyIndexer } from "../project/SocietyIndexer.ts"
import { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import { ShortTermMemoryImpl } from "../memory/ShortTermMemory.ts"
import { LongTermMemoryImpl } from "../memory/LongTermMemory.ts"
import { EpisodicMemoryImpl } from "../memory/EpisodicMemory.ts"
import { ProjectMemoryImpl } from "../memory/ProjectMemory.ts"
import { DecisionLog } from "../memory/DecisionLog.ts"
import { MetricsCollector } from "../memory/MetricsCollector.ts"
import { LanceDBStore } from "../memory/VectorStore.ts"
import { MemberOrchestrator } from "../reasoning/MemberOrchestrator.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { LLMConfig, ProviderEntry } from "../llm/types.ts"
import type { ProviderName } from "../members/types.ts"

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

function parseFlags(args: string[]): { flags: string[]; positional: string[]; providerOverride?: string; detect: boolean } {
  const flags: string[] = []
  const positional: string[] = []
  let providerOverride: string | undefined
  let detect = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && i + 1 < args.length) {
      providerOverride = args[++i]
    } else if (args[i] === '--detect') {
      detect = true
    } else {
      positional.push(args[i])
    }
  }

  return { flags, positional, providerOverride, detect }
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

  // Load Society index (members, ADRs, conventions) if available
  const societyGraphPath = join(projectPath, '.agenthood', 'society-graph.json')
  const societyGraph = new KnowledgeGraphStore()
  if (existsSync(societyGraphPath)) {
    try {
      societyGraph.load(societyGraphPath)
    } catch {
      // corrupt or missing — proceed without
    }
  }

  // Initialize vector store for persistent memory tiers
  const vectorStore = new LanceDBStore(1536)
  const memoryPath = join(projectPath, '.agenthood', 'memory')
  try {
    await vectorStore.connect(memoryPath)
  } catch {
    // vector store unavailable — memory tiers will operate without persistence
  }

  const oracleLlm = await LLMRouter.create(config)
  const oracleReg = new SkillRegistry()
  const oracleAgent = new OracleAgent(oracleLlm, new ReActLoop(oracleLlm, oracleReg), oracleReg, societyGraph)

  const ctx = {
    executionId: randomUUID(),
    project: {
      localPath: projectPath,
      name: projectPath.split(/[/\\]/).pop() ?? "project",
    },
    memory: {
      shortTerm: new ShortTermMemoryImpl(20),
      longTerm: new LongTermMemoryImpl(vectorStore),
      episodic: new EpisodicMemoryImpl(vectorStore, llm),
      project: new ProjectMemoryImpl(projectPath, societyGraph),
      decisions: new DecisionLog({ decisionsDir: join(projectPath, '.agenthood', 'decisions') }),
    },
    llm,
    prompts: new PromptBuilder(new PromptRegistry()),
    tracer: { startSpan: () => {}, endSpan: () => {} },
    artifacts: [],
    oracle: { ask: (q: string) => oracleAgent.ask(q, ctx) },
  }
  return ctx
}

export async function run(args: string[]): Promise<void> {
  const { positional, providerOverride, detect } = parseFlags(args)
  const [agentName, ...taskParts] = positional

  if (!agentName || taskParts.length === 0) {
    console.error('Usage: agenthood run <agent> "<task description>"')
    console.error('  --provider <name>   Override LLM provider (e.g. groq, anthropic, ollama)')
    console.error('  --detect            Auto-detect members for this task')
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
  const context = await createContext(process.cwd(), config)

  // Run member detection if --detect flag is set
  if (detect) {
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

  // Try Society member first
  if (memberRegistry.has(agentName)) {
    const spec = memberRegistry.get(agentName)
    const memberProvider = (config.provider ?? spec.preferredProvider) as ProviderName
    const llm = await LLMRouter.createForMember(memberProvider, config)
    const sReg = new SkillRegistry()
    const loop = new ReActLoop(llm, sReg)

    const configPath = join(process.cwd(), '.agenthood', 'config.json')
    try {
      const raw = JSON.parse(await readFile(configPath, 'utf8'))
      if (raw.skills?.autoDiscover === true) {
        await sReg.discover(join(process.cwd(), 'src', 'skills'))
      }
    } catch {
      // config not available — skip auto-discovery
    }

    const agent = new MemberAgent(spec, llm, loop, sReg)

    const metricsCollector = new MetricsCollector(join(process.cwd(), '.agenthood', 'metrics'))
    const startTime = performance.now()

    try {
      const result = await agent.run(task, context)
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(agentName, true, duration)
      console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
      return
    } catch (err) {
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(agentName, false, duration)
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
