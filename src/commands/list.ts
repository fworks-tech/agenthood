/**
 * agenthood list
 *
 * Lists all Society members and their activation status in the current
 * project. Uses the canonical MemberRegistry so it stays in sync with the
 * tool scopes and permission profiles in docs/architecture/built-in-tools.md.
 */

import { existsSync, readFileSync } from 'node:fs';
import type { CommandDescriptor } from './types.ts';
import { join } from 'node:path';
import { MemberRegistry } from '../members/MemberRegistry.ts';
import { resolveSkillsDir } from '../members.ts';
import { SkillParser } from '../skills/discovery/SkillParser.ts';
import type { SkillTier } from '../skills/discovery/ISkillManifest.ts';
import { TokenCounter } from '../core/TokenCounter.ts';
import { DEFAULT_CONTEXT_WINDOW } from '../llm/providers/constants.ts';

const TIER_BADGES: Record<SkillTier, string> = {
  official: '⬡',
  community: '○',
  experimental: '◌',
}

const skillParser = new SkillParser()

type RegistryMember = ReturnType<MemberRegistry['list']>[number]

const CATEGORY_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  validation: 'Validation',
  knowledge: 'Knowledge',
  lifecycle: 'Lifecycle',
}

export const command: CommandDescriptor = {
  name: 'list',
  description: 'List all members, their status, permission & provider',
  handler: () => list(),
}

function readTier(skillPath: string): SkillTier {
  if (!existsSync(skillPath)) return 'community'
  try {
    const content = readFileSync(skillPath, 'utf-8')
    const { frontmatter } = skillParser.parseRaw(content)
    return skillParser.parseTier(frontmatter)
  } catch {
    return 'community'
  }
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function groupByCategory(members: RegistryMember[]): Map<string, RegistryMember[]> {
  const byCategory = new Map<string, RegistryMember[]>()
  for (const m of members) {
    const group = byCategory.get(m.category) ?? []
    group.push(m)
    byCategory.set(m.category, group)
  }
  return byCategory
}

function countActiveTokens(installedPath: string, counter: TokenCounter): number {
  try {
    return counter.countTokens(readFileSync(installedPath, 'utf-8'))
  } catch {
    return 0
  }
}

function formatMemberRow(m: RegistryMember, skillsBase: string, counter: TokenCounter): { line: string; tokens: number } {
  const installedPath = join(skillsBase, m.name, `${m.name}.md`)
  const active = existsSync(installedPath)
  const status = active ? '✅' : '⬜'
  const badge = TIER_BADGES[readTier(join(skillsBase, m.name, 'SKILL.md'))]
  const tokens = active ? countActiveTokens(installedPath, counter) : 0
  const tokensCol = (`~${formatTokens(tokens)}`).padEnd(8)
  const line = `    ${status}  ${badge} ${m.name.padEnd(16)} ${m.tagline.padEnd(34)} ${m.permissionProfile.padEnd(12)} ${m.preferredProvider.padEnd(10)}${tokensCol}`
  return { line, tokens }
}

export async function list(): Promise<void> {
  const cwd = process.cwd();
  const skillsBase = resolveSkillsDir(cwd);
  const registry = new MemberRegistry();
  const counter = new TokenCounter();
  let totalTokens = 0;

  const byCategory = groupByCategory(registry.list());

  console.log('\n\u{1F3DB}️  The Society — Member Status\n');

  for (const [cat, group] of byCategory) {
    console.log(`  ${CATEGORY_LABELS[cat] ?? cat}:`);
    for (const m of group) {
      const { line, tokens } = formatMemberRow(m, skillsBase, counter)
      totalTokens += tokens;
      console.log(line);
    }
    console.log();
  }

  const pct = DEFAULT_CONTEXT_WINDOW > 0 ? Math.min((totalTokens / DEFAULT_CONTEXT_WINDOW) * 100, 100) : 0;
  console.log('  Columns: Status · Tier · Member · Tagline · Permission · Preferred Provider · Tokens');
  console.log('  Tiers: ⬡ official  ○ community  ◌ experimental');
  console.log(`  Context budget: ~${formatTokens(totalTokens)} tokens across active skills (${pct.toFixed(1)}% of the ${formatTokens(DEFAULT_CONTEXT_WINDOW)}-token default context window)\n`);
}
