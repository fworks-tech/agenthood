import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import type {
  ISkillManifest,
  ModelTargets,
  SkillDependencies,
  SkillRequires,
  SkillTier,
} from './ISkillManifest.ts'

const VALID_TIERS: SkillTier[] = ['official', 'community', 'experimental']

export interface ParsedSkill {
  name: string
  description: string
  body: string
  allowedTools?: string[]
  version?: string
  license?: string
  /** Hidden from the available-skills catalog; still activatable by name (#588). */
  hidden?: boolean
  /** A routing entry point — the only skills whose metadata loads at startup (#588). */
  router?: boolean
  /** Free-form environment requirement, max 500 chars (#581). */
  compatibility?: string
  /** Registry namespace, from `metadata.author` (#593). */
  owner?: string
  /** `source_url` — where a third-party skill came from (#154). */
  sourceUrl?: string
  /** `compaction-replay: false` — one-shot instructions (#587). */
  compactionReplay?: boolean
  /** `metadata.priority` 0-100 — higher sorts earlier in the catalog (#611). */
  priority?: number
  /** `metadata.conditions` — predicates that must hold before activation (#610). */
  conditions?: string[]
  /** `fallback` — skills to try when this one cannot activate (#613). */
  fallback?: string[]
  /** `disable-model-invocation: true` hides the skill from the catalog (#537). */
  disableModelInvocation?: boolean
  /** `model-targets` — provider/family/min-tokens/exclude (ADR-037). */
  modelTargets?: ModelTargets
  /** `requires` — tools and context the skill needs (ADR-037). */
  requires?: SkillRequires
  /** `dependencies` — other skills it needs (ADR-037). */
  dependencies?: SkillDependencies
  /** `metadata.variants` — model-id fragment → body file (ADR-037). */
  variants?: Record<string, string>
}

const SPDX_SHAPE_RE = /^[A-Za-z0-9.+-]+(?: (?:AND|OR|WITH) [A-Za-z0-9.+-]+)*$/

/**
 * `license` must look like an SPDX identifier or expression. This is a shape
 * check, not a registry lookup: every valid SPDX id passes, while prose such as
 * "MIT License" or "see LICENSE" — which no client can resolve — does not.
 */
export function isSpdxLicense(value: string): boolean {
  return value === 'UNLICENSED' || SPDX_SHAPE_RE.test(value)
}

export function parseLicense(frontmatter: Record<string, unknown> | null): string | undefined {
  const raw = frontmatter?.license
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

/** Free-form runtime requirement. The spec caps it at 500 characters; `verify` enforces that. */
export const MAX_COMPATIBILITY_LENGTH = 500

export function parseCompatibility(frontmatter: Record<string, unknown> | null): string | undefined {
  const raw = frontmatter?.compatibility
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

/** `source_url` identifies a third-party skill's origin (#154). A camelCase alias is tolerated. */
export function parseSourceUrl(frontmatter: Record<string, unknown> | null): string | undefined {
  const raw = frontmatter?.source_url ?? frontmatter?.sourceUrl
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

/** `metadata.author` names the registry namespace (#593). A flat `author` is tolerated. */
export function parseOwner(frontmatter: Record<string, unknown> | null): string | undefined {
  const meta = frontmatter?.metadata
  const nested =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).author
      : undefined
  const raw = nested ?? frontmatter?.author
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

export const MAX_SKILL_PRIORITY = 100

/** `metadata.priority`, an integer 0-100 (#611). An out-of-range value is reported by verify, not silently clamped. */
export function parsePriority(frontmatter: Record<string, unknown> | null): number | undefined {
  const meta = frontmatter?.metadata
  const raw =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).priority
      : undefined
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
}

/** Read a string-or-string-array field. `conditions` and `fallback` share the shape. */
function parseStringList(value: unknown): string[] | undefined {
  const parts = Array.isArray(value) ? value : [value]
  const items = parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function nestedField(frontmatter: Record<string, unknown> | null, key: string): unknown {
  const meta = frontmatter?.metadata
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)[key]
    : undefined
}

/** `metadata.conditions` — one predicate per entry (#610). */
export function parseConditions(frontmatter: Record<string, unknown> | null): string[] | undefined {
  return parseStringList(nestedField(frontmatter, 'conditions') ?? frontmatter?.conditions)
}

/** `fallback` — an ordered list of skills to try when activation is refused (#613). */
export function parseFallback(frontmatter: Record<string, unknown> | null): string[] | undefined {
  return parseStringList(frontmatter?.fallback)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/** `model-targets` — provider, family, min-tokens, exclude (ADR-037, #549). */
export function parseModelTargets(frontmatter: Record<string, unknown> | null): ModelTargets | undefined {
  const raw = asRecord(frontmatter?.['model-targets'] ?? frontmatter?.model_targets)
  if (!raw) return undefined
  const provider = parseStringList(raw.provider)
  const family = parseStringList(raw.family)
  const exclude = parseStringList(raw.exclude)
  const minTokens = parsePositiveInt(raw['min-tokens'] ?? raw.minTokens)
  if (!provider && !family && !exclude && minTokens === undefined) return undefined
  return {
    ...(provider ? { provider } : {}),
    ...(family ? { family } : {}),
    ...(exclude ? { exclude } : {}),
    ...(minTokens === undefined ? {} : { minTokens }),
  }
}

/** `requires` — tools, optional tools and a context window (ADR-037, #552, #554). */
export function parseRequires(frontmatter: Record<string, unknown> | null): SkillRequires | undefined {
  const raw = asRecord(frontmatter?.requires)
  if (!raw) return undefined
  const tools = parseStringList(raw.tools)
  const optionalTools = parseStringList(raw['optional-tools'] ?? raw.optionalTools)
  const context = parsePositiveInt(raw.context)
  if (!tools && !optionalTools && context === undefined) return undefined
  return {
    ...(tools ? { tools } : {}),
    ...(optionalTools ? { optionalTools } : {}),
    ...(context === undefined ? {} : { context }),
  }
}

/** `dependencies` — required and optional skills (ADR-037, #571). */
export function parseDependencies(frontmatter: Record<string, unknown> | null): SkillDependencies | undefined {
  const raw = asRecord(frontmatter?.dependencies)
  if (!raw) return undefined
  const required = parseStringList(raw.required)
  const optional = parseStringList(raw.optional)
  if (!required && !optional) return undefined
  return { ...(required ? { required } : {}), ...(optional ? { optional } : {}) }
}

/** `metadata.variants` — fragment → file inside the skill directory (ADR-037, #551). */
export function parseVariants(frontmatter: Record<string, unknown> | null): Record<string, string> | undefined {
  const raw = asRecord(nestedField(frontmatter, 'variants') ?? frontmatter?.variants)
  if (!raw) return undefined
  const entries = Object.entries(raw)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    .map(([fragment, path]): [string, string] => [fragment.trim(), path.trim()])
    .filter(([fragment]) => fragment !== '')
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** `metadata.version` (agentskills convention). Pre-release and build suffixes allowed. */
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

/**
 * Read `metadata.version`, tolerating a flat `version` key some authors use.
 * Returns undefined when absent or not a string — an unquoted `1.0` parses as a
 * number and is not a version this accepts.
 */
export function parseSkillVersion(frontmatter: Record<string, unknown> | null): string | undefined {
  const meta = frontmatter?.metadata
  const value =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>).version
      : undefined
  const raw = value ?? frontmatter?.version
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

/** `allowed-tools` is spec'd as a space-separated string, but lists and commas
 *  appear in the wild. Returns undefined when the skill declares none. */
export function parseAllowedTools(value: unknown): string[] | undefined {
  const parts = Array.isArray(value) ? value : [value]
  const tools = parts
    .filter((p): p is string => typeof p === 'string')
    .flatMap((p) => p.split(/[\s,]+/))
    .map((p) => p.trim())
    .filter(Boolean)
  return tools.length > 0 ? [...new Set(tools)] : undefined
}

export interface ParsedRaw {
  frontmatter: Record<string, unknown> | null
  body: string
  // True when strict YAML failed and the lenient fallback produced the
  // frontmatter — callers warn that the skill needs reformatting.
  heuristic?: boolean
}

export const MAX_SKILL_FILE_BYTES = 1024 * 1024

// agentskills.io spec constraints. Enforced by `verify` (and any spec gate),
// NOT by parse(): parse() must stay permissive so third-party skills that
// don't follow the convention still load at runtime rather than silently
// vanishing from discovery.
// Unicode-aware (#517): lowercase (`Ll`) and caseless (`Lo`, CJK) letters plus
// digits, so a normalized name from a non-Latin client is valid. Uppercase is
// excluded by `Ll`, and the class has no path separators or dots.
export const SPEC_NAME_RE = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024

/** NFKC-normalize a skill name so a decomposed accent and its composed form are one skill (#517). */
export function normalizeSkillName(name: string): string {
  return name.normalize('NFKC')
}

export interface SkillSpecError {
  rule: string
  message: string
  fix: string
}

export class SkillParser {
  parse(filePath: string): ParsedSkill | null {
    if (!existsSync(filePath)) return null

    let size: number
    try {
      size = statSync(filePath).size
    } catch {
      return null
    }
    if (size > MAX_SKILL_FILE_BYTES) return null

    const content = readFileSync(filePath, 'utf-8')
    const raw = this.parseRaw(content)
    if (!raw.frontmatter) return null
    if (!raw.frontmatter.description) return null

    const compatibility = parseCompatibility(raw.frontmatter)
    const owner = parseOwner(raw.frontmatter)
    const priority = parsePriority(raw.frontmatter)
    const conditions = parseConditions(raw.frontmatter)
    const fallback = parseFallback(raw.frontmatter)
    const modelTargets = parseModelTargets(raw.frontmatter)
    const requires = parseRequires(raw.frontmatter)
    const dependencies = parseDependencies(raw.frontmatter)
    const variants = parseVariants(raw.frontmatter)
    const sourceUrl = parseSourceUrl(raw.frontmatter)
    const declaredName = typeof raw.frontmatter.name === 'string' ? raw.frontmatter.name : filePath
    return {
      name: normalizeSkillName(declaredName),
      description: typeof raw.frontmatter.description === 'string' ? raw.frontmatter.description : '',
      body: raw.body,
      allowedTools: parseAllowedTools(raw.frontmatter['allowed-tools'] ?? raw.frontmatter.allowed_tools),
      version: parseSkillVersion(raw.frontmatter),
      license: parseLicense(raw.frontmatter),
      ...(compatibility ? { compatibility } : {}),
      ...(owner ? { owner } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(priority === undefined ? {} : { priority }),
      ...(conditions ? { conditions } : {}),
      ...(fallback ? { fallback } : {}),
      ...(modelTargets ? { modelTargets } : {}),
      ...(requires ? { requires } : {}),
      ...(dependencies ? { dependencies } : {}),
      ...(variants ? { variants } : {}),
      ...(raw.frontmatter['compaction-replay'] === false || raw.frontmatter.compaction_replay === false
        ? { compactionReplay: false }
        : {}),
      ...(raw.frontmatter['disable-model-invocation'] === true || raw.frontmatter.disable_model_invocation === true
        ? { disableModelInvocation: true }
        : {}),
      ...(raw.frontmatter.hidden === true ? { hidden: true } : {}),
      ...(raw.frontmatter.router === true ? { router: true } : {}),
    }
  }

  /**
   * Extract raw frontmatter key-value pairs and body from a string.
   * Shared with verify.ts to avoid duplicated parsing logic.
   */
  parseRaw(content: string): ParsedRaw {
    // Windows editors may prepend a UTF-8 BOM, which would stop the frontmatter
    // regex (anchored at ^) from matching — strip it here, the single parse chokepoint.
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) return { frontmatter: null, body: content }
    try {
      return { frontmatter: this.parseYamlStrict(match[1]), body: match[2].trim() }
    } catch {
      // Malformed frontmatter from another client (e.g. unquoted colons) —
      // still load via the lenient fallback and let callers warn.
      return { frontmatter: this.parseYaml(match[1]), body: match[2].trim(), heuristic: true }
    }
  }

  parseManifest(filePath: string, directory: string, parsed: ParsedSkill, tier: SkillTier = 'community'): ISkillManifest {
    const resources: string[] = []
    try {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && (entry.name === 'references' || entry.name === 'scripts')) {
          resources.push(...this.collectResources(join(directory, entry.name), entry.name))
        }
      }
    } catch (err) {
      if (isNonEnoentError(err)) {
        console.warn(`[SkillParser] error reading resource dirs in ${directory}:`, err)
      }
    }

    return {
      name: parsed.name,
      description: parsed.description,
      tier,
      location: filePath,
      directory,
      body: parsed.body,
      resources,
      ...(parsed.allowedTools ? { allowedTools: parsed.allowedTools } : {}),
      ...(parsed.version ? { version: parsed.version } : {}),
      ...(parsed.license ? { license: parsed.license } : {}),
      ...(parsed.compatibility ? { compatibility: parsed.compatibility } : {}),
      ...(parsed.owner ? { owner: parsed.owner } : {}),
      ...(parsed.priority === undefined ? {} : { priority: parsed.priority }),
      ...(parsed.conditions ? { conditions: parsed.conditions } : {}),
      ...(parsed.fallback ? { fallback: parsed.fallback } : {}),
      ...(parsed.modelTargets ? { modelTargets: parsed.modelTargets } : {}),
      ...(parsed.requires ? { requires: parsed.requires } : {}),
      ...(parsed.dependencies ? { dependencies: parsed.dependencies } : {}),
      ...(parsed.variants ? { variants: parsed.variants } : {}),
      ...(parsed.disableModelInvocation ? { disableModelInvocation: true } : {}),
      ...(parsed.hidden ? { hidden: true } : {}),
      ...(parsed.router ? { router: true } : {}),
    }
  }

  private collectResources(dir: string, subdirName: string): string[] {
    const resources: string[] = []
    try {
      for (const sub of readdirSync(dir, { withFileTypes: true })) {
        if (sub.isFile()) {
          resources.push(`${subdirName}/${sub.name}`)
        }
      }
    } catch (err) {
      if (isNonEnoentError(err)) {
        console.warn(`[SkillParser] error reading ${dir}:`, err)
      }
    }
    return resources
  }

  /**
   * Parse and validate the `tier` field from frontmatter.
   * Returns 'community' if missing or invalid (safe default).
   */
  parseTier(frontmatter: Record<string, unknown> | null): SkillTier {
    if (!frontmatter || typeof frontmatter.tier !== 'string') return 'community'
    const raw = frontmatter.tier.toLowerCase()
    return VALID_TIERS.includes(raw as SkillTier) ? (raw as SkillTier) : 'community'
  }

  /**
   * Validate a skill against the agentskills.io naming/description spec.
   * Returns one error per violated rule (each with a concrete fix), or an
   * empty array when the skill is spec-compliant. `dirName` is the parent
   * directory the SKILL.md lives in; `fileName` the file's basename.
   */
  validateSpec(rawName: string, description: string, rawDirName: string, fileName = 'SKILL.md'): SkillSpecError[] {
    const errors: SkillSpecError[] = []
    // Compare composed forms: a decomposed "café" and a composed one are the same skill (#517).
    const name = normalizeSkillName(rawName)
    const dirName = normalizeSkillName(rawDirName)
    if (!SPEC_NAME_RE.test(name)) {
      errors.push({
        rule: 'name-format',
        message: `name "${name}" is not lowercase alphanumeric with single hyphens`,
        fix: 'Use letters and digits in lowercase, single hyphens between words — e.g. "pdf-processing"; no leading/trailing/consecutive hyphens or uppercase',
      })
    }
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      errors.push({
        rule: 'name-length',
        message: `name length ${name.length} is outside 1-${MAX_NAME_LENGTH}`,
        fix: `Shorten the name to at most ${MAX_NAME_LENGTH} characters`,
      })
    }
    if (description.length < 1 || description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push({
        rule: 'description-length',
        message: `description length ${description.length} is outside 1-${MAX_DESCRIPTION_LENGTH}`,
        fix: `Keep the description between 1 and ${MAX_DESCRIPTION_LENGTH} characters`,
      })
    }
    if (name !== dirName) {
      errors.push({
        rule: 'name-directory-match',
        message: `name "${name}" does not match directory "${dirName}"`,
        fix: `Rename the directory to "${name}" or set the name to "${dirName}"`,
      })
    }
    if (fileName !== 'SKILL.md' && fileName.toLowerCase() !== 'skill.md') {
      errors.push({
        rule: 'filename',
        message: `file "${fileName}" is not named SKILL.md`,
        fix: 'Rename the file to SKILL.md (exact case)',
      })
    }
    return errors
  }

  /**
   * Strict frontmatter parse via js-yaml. Throws on malformed YAML (unquoted
   * colons, bad indentation) so callers can fall back to the lenient parser
   * and warn. Returns null for empty frontmatter, matching parseYaml.
   */
  private parseYamlStrict(raw: string): Record<string, unknown> | null {
    // js-yaml 5 throws YAMLException on empty/whitespace input where v4
    // returned undefined. Guard first: otherwise an empty frontmatter block
    // would reach the caller's catch and silently downgrade to the lenient
    // heuristic parser, which is a fail-open we cannot afford on a
    // trust boundary.
    if (raw.trim() === '') return null
    const loaded: unknown = loadYaml(raw)
    if (loaded === undefined || loaded === null) return null
    if (typeof loaded !== 'object' || Array.isArray(loaded)) throw new Error('frontmatter must be a key:value mapping')
    const record = loaded as Record<string, unknown>
    return Object.keys(record).length > 0 ? record : null
  }

  /**
   * Minimal frontmatter parser — flat key:value pairs only.
   *
   * **Limitations** (by design — SKILL.md frontmatter is intentionally simple):
   * - No YAML lists, nested objects, or multiline values
   * - No quoted-string handling (colons inside quoted values work; unquoted
   *   colons are treated as the key/value separator)
   * - No type coercion beyond true/false → boolean and digit strings → number
   */
  private parseYaml(raw: string): Record<string, unknown> | null {
    const result: Record<string, unknown> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx === -1) continue
      const key = trimmed.slice(0, colonIdx).trim()
      let value: unknown = trimmed.slice(colonIdx + 1).trim()
      if (typeof value === 'string') {
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (/^\d+$/.test(value)) value = Number(value)
        else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      }
      result[key] = value
    }
    return Object.keys(result).length > 0 ? result : null
  }
}

function isNonEnoentError(err: unknown): boolean {
  if (!(err instanceof Error)) return true
  const code = (err as NodeJS.ErrnoException).code
  return !code || code !== 'ENOENT'
}
