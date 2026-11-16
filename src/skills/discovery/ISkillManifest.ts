export type SkillTier = 'official' | 'community' | 'experimental'

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
}
