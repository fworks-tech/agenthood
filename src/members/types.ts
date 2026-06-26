/**
 * src/members/types.ts
 *
 * Types for the 14 Society members. Every member is described by a `MemberSpec`
 * that captures the role, tool scope, permission profile, and preferred LLM
 * provider. Specs are derived from `architecture/agent-system.md` and
 * `architecture/provider-failover.md` and are the single source of truth for
 * what each member is allowed to do in the TypeScript runtime.
 */

export type PermissionProfile = 'restricted' | 'standard' | 'trusted'

export type ProviderName = 'anthropic' | 'groq' | 'openai' | 'ollama' | 'opencode' | 'opencode-go'

export type MemberCategory = 'engineering' | 'validation' | 'knowledge' | 'lifecycle'

export interface MemberFrontMatter {
  name: string
  description: string
  license?: string
}

export interface MemberSpec {
  name: string
  description: string
  category: MemberCategory
  tagline: string
  permissionProfile: PermissionProfile
  preferredProvider: ProviderName
  tools: string[]
  systemPrompt: string
  sourcePath: string
}
