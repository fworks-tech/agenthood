import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { AgentRegistry } from '../core/AgentRegistry.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { createRedactionFilterFromConfig } from '../core/RedactionFilter.ts'
import { AnomalyDetector, appendAnomalies, createAnomalyConfigFromConfig } from '../core/AnomalyDetector.ts'
import { Tracer } from '../core/Tracer.ts'
import {
  JSONFileTraceStore,
  RetentionManager,
  createRetentionPolicyFromConfig,
  loadObservabilityConfig,
  resolveTraceStorePath,
} from '../core/TraceStore.ts'
import { EmbeddingIndex, reindexLegacyPatterns } from '../evals/EmbeddingIndex.ts'
import { EpisodeLearner } from '../evals/EpisodeLearner.ts'
import { LLMRouter } from '../llm/LLMRouter.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { LLMConfig } from '../llm/types.ts'
import { MemberRegistry, MemberAgent } from '../members/index.ts'
import type { ProviderName } from '../members/types.ts'
import { DecisionLog } from '../memory/DecisionLog.ts'
import { EpisodicMemoryImpl } from '../memory/EpisodicMemory.ts'
import { GraphSnapshot } from '../memory/GraphSnapshot.ts'
import { LongTermMemoryImpl } from '../memory/LongTermMemory.ts'
import { MetricsCollector } from '../memory/MetricsCollector.ts'
import { ProjectMemoryImpl } from '../memory/ProjectMemory.ts'
import { ProvenanceStore } from '../memory/ProvenanceStore.ts'
import { ShortTermMemoryImpl } from '../memory/ShortTermMemory.ts'
import { LanceDBStore } from '../memory/VectorStore.ts'
import type { MemberRunResult } from '../evals/EvalRunner.ts'
import { MemberOrchestrator } from '../reasoning/MemberOrchestrator.ts'
import type { DetectionResult } from '../reasoning/MemberOrchestrator.ts'
import { validateApiKeys } from '../llm/validateApiKeys.ts'
import { PromptBuilder } from '../prompts/PromptBuilder.ts'
import { PromptRegistry } from '../prompts/PromptRegistry.ts'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.ts'
import { ReActLoop } from '../reasoning/ReActLoop.ts'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import type { ISkillManifest } from '../skills/discovery/ISkillManifest.ts'
import { ActivateSkillTool } from '../skills/activation/ActivateSkillTool.ts'
import { ToolRegistry } from '../tools/ToolRegistry.ts'
import { DeveloperAgent } from '../agents/DeveloperAgent.ts'
import { ArchitectAgent } from '../agents/ArchitectAgent.ts'
import { ReviewerAgent } from '../agents/ReviewerAgent.ts'
import { QAAgent } from '../agents/QAAgent.ts'
import { OracleAgent } from '../agents/OracleAgent.ts'
import { escapeXml } from '../agents/memberLore.ts'

/**
 * Composition root for `agenthood run`. Presentation (commands) never
 * instantiates infrastructure — it consumes one of these.
 */
export class ApplicationContext {
  readonly ctx: ExecutionContext
  readonly societyGraph: KnowledgeGraphStore
  readonly agents: AgentRegistry
  readonly members: MemberRegistry
  readonly llm: ILLMProvider
  private retentionManager?: RetentionManager
  private readonly episodeLearner: EpisodeLearner
  private readonly anomalyDetector: AnomalyDetector
  private readonly alertsPath: string

  private constructor(
    projectPath: string,
    llm: ILLMProvider,
    societyGraph: KnowledgeGraphStore,
    vectorStore: LanceDBStore,
    skills: { catalog: string; manifests: Map<string, ISkillManifest> },
    sentry?: { dsn?: string },
  ) {
    this.llm = llm
    this.societyGraph = societyGraph
    this.agents = new AgentRegistry()
    this.members = new MemberRegistry()
    this.episodeLearner = new EpisodeLearner(undefined, new EmbeddingIndex(vectorStore))
    this.alertsPath = join(projectPath, '.agenthood', 'alerts', 'anomalies.ndjson')

    this.setupAgents(llm, skills.manifests)
    const oracleAgent = this.setupOracle(llm, societyGraph)
    const memory = this.buildMemoryTiers(llm, vectorStore, societyGraph, projectPath)

    const projectConfig = loadObservabilityConfig(projectPath)
    const traceStore = new JSONFileTraceStore(resolveTraceStorePath(projectPath, projectConfig))
    const redactor = createRedactionFilterFromConfig(projectConfig)
    this.anomalyDetector = new AnomalyDetector(createAnomalyConfigFromConfig(projectConfig))

    const retentionPolicy = createRetentionPolicyFromConfig(projectConfig)
    if (retentionPolicy) {
      this.retentionManager = new RetentionManager(traceStore, retentionPolicy)
      this.retentionManager.prune().catch((err) => {
        console.warn(`[run] retention prune failed: ${err instanceof Error ? err.message : String(err)}`)
      })
      this.retentionManager.start()
    }

    this.ctx = {
      executionId: randomUUID(),
      project: {
        localPath: projectPath,
        name: projectPath.split(/[/\\]/).pop() ?? 'project',
      },
      memory,
      llm,
      prompts: new PromptBuilder(new PromptRegistry()),
      tracer: new Tracer(1000, traceStore, 5000, redactor),
      artifacts: [],
      oracle: { ask: (q: string) => oracleAgent.ask(q, this.ctx) },
      skillsCatalog: skills.catalog || undefined,
      sentry,
      redactor,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }
  }

  static async create(projectPath: string, config: LLMConfig): Promise<ApplicationContext> {
    const llm = await LLMRouter.create(config)
    const societyGraph = loadSocietyGraph(projectPath)
    const skills = await discoverSkills(projectPath)
    const vectorStore = await connectVectorStore(projectPath)
    const app = new ApplicationContext(projectPath, llm, societyGraph, vectorStore, skills, config.sentry)
    try {
      await reindexLegacyPatterns(new EmbeddingIndex(vectorStore), vectorStore, (text) => llm.embed(text))
    } catch (err) {
      console.warn(`[run] pattern re-index skipped: ${err instanceof Error ? err.message : String(err)}`)
    }
    return app
  }

  static knownProviders(): string[] {
    return LLMRouter.knownProviders()
  }

  static validateConfig(config: LLMConfig): void {
    validateApiKeys(config)
  }

  /** Keyword-based member detection for `agenthood run --detect`. */
  detectMembers(task: string): DetectionResult[] {
    return new MemberOrchestrator().detectMembers({
      userMessage: task,
      changedFiles: [],
      currentStage: undefined,
    })
  }

  /** Persists a snapshot of the society knowledge graph for inspection. */
  snapshotSocietyGraph(): void {
    try {
      new GraphSnapshot({ snapshotsDir: join(process.cwd(), '.agenthood', 'snapshots') }).take(this.societyGraph)
    } catch (err) {
      console.warn(`[run] society graph snapshot unavailable: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private setupAgents(llm: ILLMProvider, skillManifests: Map<string, ISkillManifest>): void {
    const tReg = new ToolRegistry()
    const loop = new ReActLoop(llm, tReg)

    if (skillManifests.size > 0) {
      tReg.register(new ActivateSkillTool(skillManifests))
    }

    this.agents.register(new DeveloperAgent(llm, loop, tReg, this.agents, this.episodeLearner))
    this.agents.register(new ArchitectAgent(llm, loop, tReg, this.episodeLearner))
    this.agents.register(new ReviewerAgent(llm, loop, tReg, this.episodeLearner))
    this.agents.register(new QAAgent(llm, loop, tReg, this.episodeLearner))
  }

  private setupOracle(llm: ILLMProvider, societyGraph: KnowledgeGraphStore): OracleAgent {
    const oracleReg = new ToolRegistry()
    return new OracleAgent(llm, new ReActLoop(llm, oracleReg), oracleReg, societyGraph)
  }

  private buildMemoryTiers(
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

  /** Member-specific executor: preferred provider + its own tool loop */
  async runMember(memberName: string, task: string, config: LLMConfig): Promise<boolean> {
    if (!this.members.has(memberName)) return false

    const spec = this.members.get(memberName)
    await this.runAndReport(spec.name, async () => {
      const { output } = await this.runMemberTask(memberName, task, config)
      return output
    })
    return true
  }

  /**
   * Runs a member without any presentation: captures the raw output and
   * duration for evaluation while still recording metrics and flushing
   * traces. Throws on failure instead of exiting the process.
   */
  async runMemberTask(memberName: string, task: string, config: LLMConfig): Promise<MemberRunResult> {
    if (!this.members.has(memberName)) throw new Error(`unknown member "${memberName}"`)

    const spec = this.members.get(memberName)
    const memberProvider = (config.provider ?? spec.preferredProvider) as ProviderName
    const llm = await LLMRouter.createForMember(memberProvider, config)
    const sReg = new ToolRegistry()
    const loop = new ReActLoop(llm, sReg)

    if (config.skills?.autoDiscover === true) {
      try {
        await sReg.discover(join(process.cwd(), 'src', 'skills'))
      } catch (e) {
        console.warn(`[run] skill auto-discovery failed: ${(e as Error)?.message ?? e}`)
      }
    }

    const agent = new MemberAgent(spec, llm, loop, sReg, { agentRegistry: this.agents, episodeLearner: this.episodeLearner })
    const metricsCollector = new MetricsCollector(join(process.cwd(), '.agenthood', 'metrics'))
    const startTime = performance.now()

    try {
      const result = await agent.run(task, this.ctx)
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(memberName, true, duration)
      return { output: result.output, durationMs: duration }
    } catch (err) {
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(memberName, false, duration)
      throw err
    } finally {
      await this.flushTraces()
    }
  }

  /** Fallback for non-member agent names (core agents). */
  async runAgent(agentName: string, task: string): Promise<void> {
    await this.runAndReport(agentName, async () => {
      const agent = this.agents.get(agentName)
      return (await agent.run(task, this.ctx)).output
    })
  }

  private async runAndReport(
    displayName: string,
    run: () => Promise<string>,
  ): Promise<void> {
    try {
      const output = await run()
      console.log(`\n\u2714 ${displayName} result:\n${output}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.flushTraces()
      console.error(`Error running "${displayName}": ${msg}`)
      process.exit(1)
    }
    await this.flushTraces()
  }

  /** Flushes pending trace envelopes to the store before the process exits. */
  async flushTraces(): Promise<void> {
    try {
      await this.ctx.tracer.flush()
      await this.evaluateAnomalies()
    } catch (err) {
      console.error(`[run] trace flush failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /** Scores the recent in-process envelopes and appends any anomalies. */
  private async evaluateAnomalies(): Promise<void> {
    const recent = this.ctx.tracer.getRecent(this.ctx.tracer.size)
    if (recent.length === 0) return
    const anomalies = this.anomalyDetector.evaluate(recent)
    if (anomalies.length === 0) return
    try {
      await appendAnomalies(this.alertsPath, anomalies)
    } catch (err) {
      console.warn(`[run] anomaly persistence failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
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

async function discoverSkills(projectPath: string): Promise<{ catalog: string; manifests: Map<string, ISkillManifest> }> {
  const discovery = new SkillDiscovery()
  const manifests = discovery.discover(projectPath)
  if (manifests.length === 0) return { catalog: '', manifests: new Map() }

  const lines: string[] = ['', '<available_skills>']
  const map = new Map<string, ISkillManifest>()
  for (const m of manifests) {
    map.set(m.name, m)
    lines.push(`  <skill name="${escapeXml(m.name)}">`)
    lines.push(`    <description>${escapeXml(m.description)}</description>`)
    lines.push(`    <location>${escapeXml(m.location)}</location>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')
  lines.push('')
  lines.push('When a task matches a skill\'s description, call the activate_skill tool with the skill\'s name to load its full instructions.')
  lines.push('')

  return { catalog: lines.join('\n'), manifests: map }
}
