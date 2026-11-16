export type SkillTier = 'official' | 'community' | 'experimental'

/** `model-targets` — which models a skill is calibrated for (ADR-037). */
export interface ModelTargets {
  /** Provider names, case-insensitive exact match. */
  provider?: string[]
  /** Model-id fragments; one must appear in the current model id. */
  family?: string[]
  /** Minimum context window in tokens. */
  minTokens?: number
  /** Model-id fragments that are refused even when the family matches. */
  exclude?: string[]
}

/** `requires` — what the session must provide (ADR-037). */
export interface SkillRequires {
  /** Tool names, exact or `mcp.` prefix. Unmet blocks activation. */
  tools?: string[]
  /** Tool names whose absence only warns. */
  optionalTools?: string[]
  /** Minimum context window in tokens. */
  context?: number
}

/** `dependencies` — other skills this one needs (ADR-037). */
export interface SkillDependencies {
  required?: string[]
  optional?: string[]
}

export interface ISkillManifest {
  name: string
  description: string
  tier: SkillTier
  location: string
  directory: string
  body: string
  resources: string[]
  /** Tools the skill declares it may use (`allowed-tools`). Undeclared = no restriction. */
  allowedTools?: string[]
  /** `metadata.version` — semver, used by `agenthood bump` and the lockfile. */
  version?: string
  /** SPDX identifier or expression from `license`. */
  license?: string
  /** Free-form runtime requirement (`compatibility`), capped at 500 chars. */
  compatibility?: string
  /** Registry namespace from `metadata.author` — the `owner` in `owner/name` (ADR-035). */
  owner?: string
  /** `source_url` — where a third-party skill came from (#154). */
  sourceUrl?: string
  /** `metadata.priority` 0-100 — higher sorts earlier in the catalog (#611). */
  priority?: number
  /** `metadata.conditions` — predicates that must hold before activation (#610). */
  conditions?: string[]
  /** `fallback` — skills to try when this one cannot activate (#613). */
  fallback?: string[]
  /** `disable-model-invocation: true` hides the skill from the catalog (#537). */
  disableModelInvocation?: boolean
  /** Hidden from the available-skills catalog; still activatable by name (#588). */
  hidden?: boolean
  /** A routing entry point — the only skills whose metadata loads at startup (#588). */
  router?: boolean
  /** `model-targets` — provider/family/min-tokens/exclude (ADR-037). */
  modelTargets?: ModelTargets
  /** `requires` — tools and context the skill needs (ADR-037). */
  requires?: SkillRequires
  /** `dependencies` — other skills it needs (ADR-037). */
  dependencies?: SkillDependencies
  /** `metadata.variants` — model-id fragment → body file inside the skill directory (ADR-037). */
  variants?: Record<string, string>
  /**
   * `compaction-replay: false` — one-shot instructions. Compaction may drop the
   * body and a re-activation always reloads it (#587).
   */
  compactionReplay?: boolean
}
