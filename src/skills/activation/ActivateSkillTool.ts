import type { ITool, ToolResult } from '../../tools/ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { realpathSync } from 'node:fs'
import { recordSkillActivation } from './SkillStats.ts'
import { SkillBudget } from './SkillBudget.ts'
import { evaluateConditions } from './conditions.ts'
import { formatSkillContent, SKILL_ACTIVATION_PREFIX, type SkillContentFormat } from './skillContent.ts'
import { findMissingReferences } from './references.ts'
import { gateSkills, type GateResult, type SkillAvailability } from '../discovery/gating.ts'
import { selectVariantBody } from '../discovery/variants.ts'
import { escapeXml } from '../../agents/memberLore.ts'

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
  /** Names activated in this run, shared with `run_skill_script` (ADR-036). */
  activeSkills?: Set<string>
  /** `security.autoAllowSkillDirs: false` keeps skill dirs out of the read allowlist (#536). */
  autoAllowSkillDirs?: boolean
  /** What this run offers; unusable skills are refused with the gate's reason (ADR-037). */
  availability?: SkillAvailability
}

export class ActivateSkillTool implements ITool {
  name = 'activate_skill'
  description = 'Load the full instructions for a skill by name. Call this when a task matches a skill\'s description in the available skills list.'
  inputSchema: JSONSchema

  private readonly budget: SkillBudget
  /** Re-activating the same skill returns the same block (#531). */
  private readonly cache = new Map<string, string>()
  /** One gate for the whole run, so every refusal states the same reason (ADR-037). */
  private readonly gate: GateResult

  constructor(
    private manifests: Map<string, ISkillManifest>,
    contextWindow?: number,
    private options: ActivateSkillOptions = {},
  ) {
    this.budget = new SkillBudget(contextWindow)
    this.gate = gateSkills(Array.from(manifests.values()), options.availability)
    this.inputSchema = ActivateSkillTool.buildSchema(manifests, options.disabled, this.gate)
  }

  /**
   * `skill_name` is an enum of the names the model can actually activate, so the
   * call cannot miss on a guessed name (#531). No enum when every skill is
   * filtered — an empty enum is not valid JSON Schema.
   */
  private static buildSchema(
    manifests: Map<string, ISkillManifest>,
    disabled: ReadonlySet<string> | undefined,
    gate: GateResult,
  ): JSONSchema {
    const names = Array.from(manifests.keys()).filter((name) => !disabled?.has(name) && !gate.blocked.has(name))
    return {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'Name of the skill to activate',
          ...(names.length > 0 ? { enum: names } : {}),
        },
        eager: { type: 'boolean', description: 'List more bundled resources (contents are never read)' },
      },
      required: ['skill_name'],
    }
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { skill_name, eager } = input as { skill_name: string; eager?: boolean }
    return this.activate(skill_name, context, [], Boolean(eager))
  }

  private activate(name: string, context: ExecutionContext, attempted: string[], eager = false): ToolResult {
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

    const blockedReason = this.gate.blocked.get(name)
    if (blockedReason) {
      console.log(`[skills] blocked "${name}": ${blockedReason}`)
      const next = this.nextFallback(manifest, name, attempted)
      if (next) {
        console.warn(`[skills] "${name}" cannot run here — falling back to "${next}"`)
        return this.activate(next, context, [...attempted, name], eager)
      }
      return fail(`Skill "${name}" cannot activate here: ${blockedReason}`)
    }

    const conditions = evaluateConditions(manifest.conditions, projectPath)
    if (!conditions.ok) {
      console.warn(`[skills] skipped "${name}": ${conditions.reason}`)
      const next = this.nextFallback(manifest, name, attempted)
      if (next) {
        console.warn(`[skills] "${name}" unavailable — falling back to "${next}"`)
        return this.activate(next, context, [...attempted, name], eager)
      }
      return fail(`Skill "${name}" cannot activate here: ${conditions.reason}`)
    }

    this.recordForRun(name, context, manifest)

    const cachedKey = `${name}\u0000${attempted.join('>')}\u0000${eager}`
    const cached = this.cache.get(cachedKey)
    recordSkillActivation(projectPath, name, true)
    if (cached) return { success: true, output: cached }

    // A body already in the transcript cannot be shrunk later, so the budget is
    // applied here, against what is already loaded. The variant, when one
    // matches the model, is what gets loaded (ADR-037, #551).
    const model = this.options.availability?.model
    const variant = selectVariantBody(manifest, model)
    const fit = this.budget.fit(variant.body)
    const missing = findMissingReferences(variant.body, manifest.directory)
    const notices = [
      fit.compressed
        ? `<skill_budget>Instructions compressed to fit the context window — saved ~${fit.savedTokens} tokens. Re-read SKILL.md from the skill directory for the full steps.</skill_budget>`
        : undefined,
      missing.length > 0
        ? `<skill_missing_references>Not found under the skill directory: ${missing.join(', ')}. They may be created at run time.</skill_missing_references>`
        : undefined,
      variant.variant
        ? `<skill_variant name="${escapeXml(variant.variant)}" model="${escapeXml(model ?? 'unknown')}" />`
        : undefined,
      variant.warning ? `<skill_variant_warning>${escapeXml(variant.warning)}</skill_variant_warning>` : undefined,
      ...(this.gate.warnings.get(name) ?? []).map((message) => `<skill_warning>${escapeXml(message)}</skill_warning>`),
    ].filter(Boolean)

    const output = formatSkillContent(manifest, fit.body, {
      format: this.options.format,
      trigger: attempted.length > 0 ? 'fallback' : 'model',
      now: this.options.now?.(),
      notice: notices.join('\n') || undefined,
      fallbackFrom: attempted.at(-1),
      eager,
    })
    this.cache.set(cachedKey, output)
    return { success: true, output }
  }

  /** Activation is what authorizes a script run and read access (#536, ADR-036). */
  private recordForRun(name: string, context: ExecutionContext, manifest: ISkillManifest): void {
    this.options.activeSkills?.add(name)
    if (this.options.autoAllowSkillDirs === false) return
    // Realpath first: a symlinked skill directory must not widen the allowlist
    // to whatever it points at.
    let directory: string
    try {
      directory = realpathSync(manifest.directory)
    } catch {
      directory = manifest.directory
    }
    context.skillAllowlist ??= new Set()
    if (context.skillAllowlist.has(directory)) return
    context.skillAllowlist.add(directory)
    console.log(`[skills] auto-allowlisted ${directory} for "${name}" (this run only)`)
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
