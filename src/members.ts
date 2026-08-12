/**
 * src/members.ts
 *
 * Single source of truth for all Society members and runtime detection.
 * Every command imports from here — never define these lists again.
 *
 * Member specs (tools, permissions, providers) are maintained in MemberRegistry
 * at `src/members/MemberRegistry.ts`, derived from the docs/architecture docs.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MemberRegistry } from './members/MemberRegistry.ts';

export interface Member {
  name: string
  tagline: string
}

const registry = new MemberRegistry();

export const ALL_MEMBERS: Member[] = registry.list().map((s) => ({
  name: s.name,
  tagline: s.tagline,
}))

export const MEMBER_NAMES: string[] = ALL_MEMBERS.map(m => m.name)

/** Member names are refs into git pathspecs and filesystem paths — hostile
 * values could otherwise inject shell commands (see rollback/verify) */
export const MEMBER_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/

/** Single source of truth for where each runtime's member skills live —
 * consumed by init (installSkills/planPaths) and eject (cleanup). */
export const RUNTIME_SKILL_DIRS: Record<Runtime, string> = {
  'claude-code': '.claude/skills',
  copilot: '.github/skills',
  'gemini-cli': '.gemini/skills',
  other: '.agenthood/skills',
}

export type Runtime = 'claude-code' | 'copilot' | 'gemini-cli' | 'other'

export function resolveSkillsDir(cwd: string): string {
  if (existsSync(join(cwd, '.claude')))     return join(cwd, '.claude',    'skills')
  if (existsSync(join(cwd, '.codebuddy')))  return join(cwd, '.codebuddy', 'skills')
  if (existsSync(join(cwd, '.gemini')))     return join(cwd, '.gemini',    'skills')
  return join(cwd, '.agenthood', 'skills')
}
