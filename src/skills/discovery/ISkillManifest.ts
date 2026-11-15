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
}
