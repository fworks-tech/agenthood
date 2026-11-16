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
  /** Hidden from the available-skills catalog; still activatable by name (#588). */
  hidden?: boolean
  /** A routing entry point — the only skills whose metadata loads at startup (#588). */
  router?: boolean
}
