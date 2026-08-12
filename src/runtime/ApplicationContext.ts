import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { AgentRegistry } from '../core/AgentRegistry.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import { LLMRouter } from '../llm/LLMRouter.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { LLMConfig } from '../llm/types.ts'
import { MemberRegistry, MemberAgent } from '../members/index.ts'
import type { ProviderName } from '../members/types.ts'
import { DecisionLog } from '../memory/DecisionLog.ts'
import { EpisodicMemoryImpl } from '../memory/EpisodicMemory.ts'
import { LongTermMemoryImpl } from '../memory/LongTermMemory.ts'
import { MetricsCollector } from '../memory/MetricsCollector.ts'
import { ProjectMemoryImpl } from '../memory/ProjectMemory.ts'
import { ProvenanceStore } from '../memory/ProvenanceStore.ts'
import { ShortTermMemoryImpl } from '../memory/ShortTermMemory.ts'
import { LanceDBStore } from '../memory/VectorStore.ts'
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

  private constructor(
    projectPath: string,
    llm: ILLMProvider,
    societyGraph: KnowledgeGraphStore,
    vectorStore: LanceDBStore,
    skills: { catalog: string; manifests: Map<string, ISkillManifest> },
  ) {
    this.llm = llm
    this.societyGraph = societyGraph
    this.agents = new AgentRegistry()
    this.members = new MemberRegistry()

    this.setupAgents(llm, skills.manifests)
    const oracleAgent = this.setupOracle(llm, societyGraph)
    const memory = this.buildMemoryTiers(llm, vectorStore, societyGraph, projectPath)

    const spans: Array<{ name: string; startedAt: string }> = []
    this.ctx = {
      executionId: randomUUID(),
      project: {
        localPath: projectPath,
        name: projectPath.split(/[/\\]/).pop() ?? 'project',
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
      oracle: { ask: (q: string) => oracleAgent.ask(q, this.ctx) },
      skillsCatalog: skills.catalog || undefined,
    }
  }

  static async create(projectPath: string, config: LLMConfig): Promise<ApplicationContext> {
    const llm = await LLMRouter.create(config)
    const societyGraph = loadSocietyGraph(projectPath)
    const skills = await discoverSkills(projectPath)
    const vectorStore = await connectVectorStore(projectPath)
    return new ApplicationContext(projectPath, llm, societyGraph, vectorStore, skills)
  }

  private setupAgents(llm: ILLMProvider, skillManifests: Map<string, ISkillManifest>): void {
    const tReg = new ToolRegistry()
    const loop = new ReActLoop(llm, tReg)

    if (skillManifests.size > 0) {
      tReg.register(new ActivateSkillTool(skillManifests))
    }

    this.agents.register(new DeveloperAgent(llm, loop, tReg, this.agents))
    this.agents.register(new ArchitectAgent(llm, loop, tReg))
    this.agents.register(new ReviewerAgent(llm, loop, tReg))
    this.agents.register(new QAAgent(llm, loop, tReg))
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

    const agent = new MemberAgent(spec, llm, loop, sReg, this.agents)
    const metricsCollector = new MetricsCollector(join(process.cwd(), '.agenthood', 'metrics'))
    const startTime = performance.now()

    try {
      const result = await agent.run(task, this.ctx)
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(memberName, true, duration)
      console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
    } catch (err) {
      const duration = Math.round(performance.now() - startTime)
      metricsCollector.record(memberName, false, duration)
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Error running member "${memberName}": ${msg}`)
      process.exit(1)
    }
    return true
  }

  /** Fallback for non-member agent names (core agents). */
  async runAgent(agentName: string, task: string): Promise<void> {
    try {
      const agent = this.agents.get(agentName)
      const result = await agent.run(task, this.ctx)
      console.log(`\n\u2714 ${result.role} result:\n${result.output}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Error running agent "${agentName}": ${msg}`)
      process.exit(1)
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
