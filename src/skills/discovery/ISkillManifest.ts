export type SkillTier = 'official' | 'community' | 'experimental'

export interface ISkillManifest {
  name: string
  description: string
  tier: SkillTier
  location: string
  directory: string
  body: string
  resources: string[]
}
