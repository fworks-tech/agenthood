import type { ITool, ToolResult } from '../../tools/ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { recordSkillActivation } from './SkillStats.ts'
import { SkillBudget } from './SkillBudget.ts'
import { evaluateConditions } from './conditions.ts'
import { formatSkillContent, SKILL_ACTIVATION_PREFIX, type SkillContentFormat } from './skillContent.ts'

export { SKILL_ACTIVATION_PREFIX }

/** Deepest fallback chain followed before giving up (#613). */
const MAX_FALLBACK_DEPTH = 3

export interface ActivateSkillOptions {
  /** Names disabled in config — refused outright (#537). */
  disabled?: ReadonlySet<string>
  /** `false` disables fallback chains (#613). */
  fallback?: boolean
  /** Wrapping format for activated content (#535). */
  format?: SkillContentFormat
  /** Injectable clock for deterministic output in tests. */
  now?: () => string
}

export class ActivateSkillTool implements ITool {
  name = 'activate_skill'
  description = 'Load the full instructions for a skill by name. Call this when a task matches a skill\'s description in the available skills list.'
  inputSchema: JSONSchema

  private readonly budget: SkillBudget
  /** Re-activating the same skill returns the same block (#531). */
  private readonly cache = new Map<string, string>()

  constructor(
    private manifests: Map<string, ISkillManifest>,
    contextWindow?: number,
    private options: ActivateSkillOptions = {},
  ) {
    this.budget = new SkillBudget(contextWindow)
    this.inputSchema = ActivateSkillTool.buildSchema(manifests, options.disabled)
  }

  /**
   * `skill_name` is an enum of the names the model can actually activate, so the
   * call cannot miss on a guessed name (#531). No enum when every skill is
   * filtered — an empty enum is not valid JSON Schema.
   */
  private static buildSchema(manifests: Map<string, ISkillManifest>, disabled?: ReadonlySet<string>): JSONSchema {
    const names = Array.from(manifests.keys()).filter((name) => !disabled?.has(name))
    return {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill to activate',
          ...(names.length > 0 ? { enum: names } : {}),
        },
      },
      required: ['skill_name'],
    }
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { skill_name } = input as { skill_name: string }
    return this.activate(skill_name, context, [])
  }

  private activate(name: string, context: ExecutionContext, attempted: string[]): ToolResult {
    const projectPath = context.project.localPath
    const fail = (error: string, skill = name): ToolResult => {
      recordSkillActivation(projectPath, skill, false)
      return { success: false, output: '', error }
    }

    if (this.options.disabled?.has(name)) {
      return fail(`Skill "${name}" is disabled in .agenthood/config.json. Remove it from skills.disabled to use it.`)
    }

    const manifest = this.manifests.get(name)
    if (!manifest) {
      const available = Array.from(this.manifests.keys())
        .filter((key) => !this.options.disabled?.has(key))
        .join(', ')
      return fail(`Skill "${name}" not found. Available skills: ${available || '(none)'}`)
    }

    const conditions = evaluateConditions(manifest.conditions, projectPath)
    if (!conditions.ok) {
      console.warn(`[skills] skipped "${name}": ${conditions.reason}`)
      const next = this.nextFallback(manifest, name, attempted)
      if (next) {
        console.warn(`[skills] "${name}" unavailable — falling back to "${next}"`)
        return this.activate(next, context, [...attempted, name])
      }
      return fail(`Skill "${name}" cannot activate here: ${conditions.reason}`)
    }

    const cachedKey = `${name}\u0000${attempted.join('>')}`
    const cached = this.cache.get(cachedKey)
    recordSkillActivation(projectPath, name, true)
    if (cached) return { success: true, output: cached }

    // A body already in the transcript cannot be shrunk later, so the budget is
    // applied here, against what is already loaded.
    const fit = this.budget.fit(manifest.body)
    const notice = fit.compressed
      ? `<skill_budget>Instructions compressed to fit the context window — saved ~${fit.savedTokens} tokens. Re-read SKILL.md from the skill directory for the full steps.</skill_budget>`
      : undefined

    const output = formatSkillContent(manifest, fit.body, {
      format: this.options.format,
      trigger: attempted.length > 0 ? 'fallback' : 'model',
      now: this.options.now?.(),
      notice,
      fallbackFrom: attempted.at(-1),
    })
    this.cache.set(cachedKey, output)
    return { success: true, output }
  }

  /**
   * The next skill in a fallback chain that has not already been tried. A chain
   * that loops back to an attempted skill stops instead of spinning.
   */
  private nextFallback(manifest: ISkillManifest, current: string, attempted: string[]): string | undefined {
    if (this.options.fallback === false) return undefined
    if (attempted.length >= MAX_FALLBACK_DEPTH) return undefined
    const tried = new Set([...attempted, current])
    return manifest.fallback?.find((name) => !tried.has(name) && this.manifests.has(name))
  }
}
