import { randomUUID } from "node:crypto"
import type { CommandDescriptor } from "./types.js"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { PromptBuilder } from "../prompts/PromptBuilder.ts"
import { PromptRegistry } from "../prompts/PromptRegistry.ts"
import { LLMRouter } from "../llm/LLMRouter.ts"
import { ToolRegistry } from "../tools/ToolRegistry.ts"
import { ReActLoop } from "../reasoning/ReActLoop.ts"
import { AgentRegistry } from "../core/AgentRegistry.ts"
import { DeveloperAgent } from "../agents/DeveloperAgent.ts"
import { ArchitectAgent } from "../agents/ArchitectAgent.ts"
import { ReviewerAgent } from "../agents/ReviewerAgent.ts"
import { QAAgent } from "../agents/QAAgent.ts"
import { OracleAgent } from "../agents/OracleAgent.ts"
import { MemberRegistry, MemberAgent } from "../members/index.ts"
import { validateApiKeys, MissingApiKeyError } from "../llm/validateApiKeys.ts"
import { KnowledgeGraphStore } from "../rag/KnowledgeGraphStore.ts"
import { ShortTermMemoryImpl } from "../memory/ShortTermMemory.ts"
import { LongTermMemoryImpl } from "../memory/LongTermMemory.ts"
import { EpisodicMemoryImpl } from "../memory/EpisodicMemory.ts"
import { ProjectMemoryImpl } from "../memory/ProjectMemory.ts"
import { DecisionLog } from "../memory/DecisionLog.ts"
import { ProvenanceStore } from "../memory/ProvenanceStore.ts"
import { GraphSnapshot } from "../memory/GraphSnapshot.ts"
import { MetricsCollector } from "../memory/MetricsCollector.ts"
import { LanceDBStore } from "../memory/VectorStore.ts"
import { MemberOrchestrator } from "../reasoning/MemberOrchestrator.ts"
import { SkillDiscovery } from "../skills/discovery/SkillDiscovery.ts"
import { ActivateSkillTool } from "../skills/activation/ActivateSkillTool.ts"
import type { ExecutionContext } from "../core/ExecutionContext.ts"
import type { ILLMProvider } from "../llm/ILLMProvider.ts"
import type { LLMConfig, ProviderEntry } from "../llm/types.ts"
import type { ProviderName } from "../members/types.ts"
import type { ISkillManifest } from "../skills/discovery/ISkillManifest.ts"

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

async function discoverSkills(): Promise<{ catalog: string; manifests: Map<string, ISkillManifest> }> {
  const discovery = new SkillDiscovery()
  const manifests = discovery.discover(process.cwd())
  if (manifests.length === 0) return { catalog: '', manifests: new Map() }

  const lines: string[] = ['', '<available_skills>']
  const map = new Map<string, ISkillManifest>()
  for (const m of manifests) {
    map.set(m.name, m)
    lines.push(`  <skill name="${m.name}">`)
    lines.push(`    <description>${m.description}</description>`)
    lines.push(`    <location>${m.location}</location>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  lines.push('')
  lines.push('When a task matches a skill\'s description, call the activate_skill tool with the skill\'s name to load its full instructions.')
  lines.push('')

  return { catalog: lines.join('\n'), manifests: map }
}

async function createContext(projectPath: string, config: LLMConfig): Promise<{ ctx: ExecutionContext; societyGraph: KnowledgeGraphStore }> {
  const llm = await LLMRouter.create(config)
  const societyGraph = loadSocietyGraph(projectPath)
  const vectorStore = await connectVectorStore(projectPath)
  const { catalog, manifests } = await discoverSkills()

  setupAgents(llm, manifests)
  const oracleAgent = setupOracle(llm, societyGraph)
  const memory = buildMemoryTiers(llm, vectorStore, societyGraph, projectPath)

  const spans: Array<{ name: string; startedAt: string }> = []
  const ctx: ExecutionContext = {
    executionId: randomUUID(),
    project: {
      localPath: projectPath,
      name: projectPath.split(/[/\\]/).pop() ?? "project",
    },
    memory,
    llm,
    prompts: new PromptBuilder(new PromptRegistry()),
    tracer: {
      startSpan: (name: string) => {
        spans.push({ name, startedAt: new Date().toISOString() })
      },
      endSpan: () => {},
    },
    artifacts: [],
    oracle: { ask: (q: string) => oracleAgent.ask(q, ctx) },
    skillsCatalog: catalog || undefined,
  }
  return { ctx, societyGraph }
}

function loadSocietyGraph(projectPath: string): KnowledgeGraphStore {
  const graph = new KnowledgeGraphStore()
  const graphPath = join(projectPath, '.agenthood', 'society-graph.json')
  if (existsSync(graphPath)) {
    try {
      graph.load(graphPath)
    } catch (e) {
      console.warn(`[run] society graph unavailable: ${(e as Error)?.message ?? e}`)
    }
  }
  return graph
}

async function connectVectorStore(projectPath: string): Promise<LanceDBStore> {
  const vectorStore = new LanceDBStore(1536)
  const memoryPath = join(projectPath, '.agenthood', 'memory')
  try {
    await vectorStore.connect(memoryPath)
  } catch (e) {
    console.warn(`[run] vector store unavailable: ${(e as Error)?.message ?? e}`)
  }
  return vectorStore
}

function setupAgents(llm: ILLMProvider, skillManifests: Map<string, ISkillManifest>): void {
  const tReg = new ToolRegistry()
  const loop = new ReActLoop(llm, tReg)

  if (skillManifests.size > 0) {
    tReg.register(new ActivateSkillTool(skillManifests))
  }

  agentRegistry.register(new DeveloperAgent(llm, loop, tReg, agentRegistry))
  agentRegistry.register(new ArchitectAgent(llm, loop, tReg))
  agentRegistry.register(new ReviewerAgent(llm, loop, tReg))
  agentRegistry.register(new QAAgent(llm, loop, tReg))
}

function setupOracle(llm: ILLMProvider, societyGraph: KnowledgeGraphStore): OracleAgent {
  const oracleReg = new ToolRegistry()
  return new OracleAgent(llm, new ReActLoop(llm, oracleReg), oracleReg, societyGraph)
}

function buildMemoryTiers(
  llm: ILLMProvider,
  vectorStore: LanceDBStore,
  societyGraph: KnowledgeGraphStore,
  projectPath: string,
): ExecutionContext['memory'] {
  return {
    shortTerm: new ShortTermMemoryImpl(20),
    longTerm: new LongTermMemoryImpl(vectorStore),
    episodic: new EpisodicMemoryImpl(vectorStore, llm),
    project: new ProjectMemoryImpl(projectPath, societyGraph),
    decisions: new DecisionLog({ decisionsDir: join(projectPath, '.agenthood', 'decisions') }),
    provenance: new ProvenanceStore({ provenanceDir: join(projectPath, '.agenthood', 'provenance') }),
  }
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

async function runSocietyMember(agentName: string, task: string, config: LLMConfig, context: ExecutionContext): Promise<boolean> {
  if (!memberRegistry.has(agentName)) return false

  const spec = memberRegistry.get(agentName)
  const memberProvider = (config.provider ?? spec.preferredProvider) as ProviderName
  const llm = await LLMRouter.createForMember(memberProvider, config)
  const sReg = new ToolRegistry()
  const loop = new ReActLoop(llm, sReg)

  const configPath = join(process.cwd(), '.agenthood', 'config.json')
  try {
    const raw = JSON.parse(await readFile(configPath, 'utf8'))
    if (raw.skills?.autoDiscover === true) {
      await sReg.discover(join(process.cwd(), 'src', 'skills'))
    }
  } catch (e) {
    console.warn(`[run] skill auto-discovery config unavailable: ${(e as Error)?.message ?? e}`)
  }

  const agent = new MemberAgent(spec, llm, loop, sReg, agentRegistry)
  const metricsCollector = new MetricsCollector(join(process.cwd(), '.agenthood', 'metrics'))
  const startTime = performance.now()

  try {
    const result = await agent.run(task, context)
    const duration = Math.round(performance.now() - startTime)
    metricsCollector.record(agentName, true, duration)
    console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    metricsCollector.record(agentName, false, duration)
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Error running member "${agentName}": ${msg}`)
    process.exit(1)
  }
  return true
}

async function runFallbackAgent(agentName: string, task: string, context: ExecutionContext): Promise<void> {
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

  const { ctx: context, societyGraph } = await createContext(process.cwd(), config)

  if (shouldDetect) {
    await runDetection(task)
  }

  const handled = await runSocietyMember(agentName, task, config, context)
  if (!handled) {
    await runFallbackAgent(agentName, task, context)
  }

  try {
    new GraphSnapshot({ snapshotsDir: join(process.cwd(), '.agenthood', 'snapshots') }).take(societyGraph)
  } catch (err) {
    console.warn(`[run] society graph snapshot unavailable: ${(err as Error)?.message ?? err}`)
  }
}
