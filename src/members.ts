/**
 * src/members.ts
 *
 * Single source of truth for all 14 Society members and runtime detection.
 * Every command imports from here — never define these lists again.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Member {
  name: string
  tagline: string
}

export const ALL_MEMBERS: Member[] = [
  { name: 'the-scribe',    tagline: 'Commits, PRs, changelogs' },
  { name: 'the-architect', tagline: 'Specs, planning, ADRs' },
  { name: 'the-reviewer',  tagline: 'Five-axis code review' },
  { name: 'the-tester',    tagline: 'TDD and test generation' },
  { name: 'the-debugger',  tagline: 'Root cause analysis' },
  { name: 'the-auditor',   tagline: 'Security and dependencies' },
  { name: 'the-herald',    tagline: 'Releases and versioning' },
  { name: 'the-librarian', tagline: 'Documentation and ADRs' },
  { name: 'the-doorman',   tagline: 'Validation and enforcement' },
  { name: 'the-oracle',    tagline: 'Research and knowledge' },
  { name: 'the-envoy',     tagline: 'Communication and handoffs' },
  { name: 'the-sentinel',  tagline: 'Member file validation' },
  { name: 'the-warden',    tagline: 'File size enforcement' },
  { name: 'the-steward',   tagline: 'Context and routing' },
]

export const MEMBER_NAMES: string[] = ALL_MEMBERS.map(m => m.name)

export type Runtime = 'claude-code' | 'copilot' | 'gemini-cli' | 'other'

export function resolveSkillsDir(cwd: string): string {
  if (existsSync(join(cwd, '.claude')))     return join(cwd, '.claude',    'skills')
  if (existsSync(join(cwd, '.codebuddy')))  return join(cwd, '.codebuddy', 'skills')
  if (existsSync(join(cwd, '.gemini')))     return join(cwd, '.gemini',    'skills')
  return join(cwd, '.agenthood', 'skills')
}
