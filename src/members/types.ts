/**
 * src/members/types.ts
 *
 * Types for the Society members. Every member is described by a `MemberSpec`
 * that captures the role, tool scope, permission profile, and preferred LLM
 * provider. Specs are derived from `docs/architecture/agent-system.md` and
 * `docs/architecture/provider-failover.md` and are the single source of truth for
 * what each member is allowed to do in the TypeScript runtime.
 */

export type PermissionProfile = 'restricted' | 'standard' | 'trusted'

export type ProviderName = 'anthropic' | 'groq' | 'openai' | 'ollama' | 'opencode' | 'opencode-go' | 'openrouter'

export type MemberCategory = 'engineering' | 'validation' | 'knowledge' | 'lifecycle'

export type OutputFormatMode = 'strict' | 'lenient'

export interface MemberFrontMatter {
  name: string
  description: string
  license?: string
  output_format?: string
  output_format_mode?: OutputFormatMode
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
  /** Opt-in: grants the delegate_task tool so the member can call other agents */
  canDelegate?: boolean
  /** Regex the run output must match; unset = no format validation */
  output_format?: string
  /** Whether a format deviation fails the run (strict) or warns (lenient) */
  output_format_mode?: OutputFormatMode
}
