/**
 * src/members.ts
 *
 * Single source of truth for all Society members and runtime detection.
 * Every command imports from here — never define these lists again.
 *
 * Member specs (tools, permissions, providers) are maintained in MemberRegistry
 * at `src/members/MemberRegistry.ts`, derived from the architecture docs.
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

export type Runtime = 'claude-code' | 'copilot' | 'gemini-cli' | 'other'

export function resolveSkillsDir(cwd: string): string {
  if (existsSync(join(cwd, '.claude')))     return join(cwd, '.claude',    'skills')
  if (existsSync(join(cwd, '.codebuddy')))  return join(cwd, '.codebuddy', 'skills')
  if (existsSync(join(cwd, '.gemini')))     return join(cwd, '.gemini',    'skills')
  return join(cwd, '.agenthood', 'skills')
}
