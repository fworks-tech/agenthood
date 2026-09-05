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

const TIER_BADGES: Record<SkillTier, string> = {
  official: '⬡',
  community: '○',
  experimental: '◌',
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
    const { frontmatter } = new SkillParser().parseRaw(content)
    return new SkillParser().parseTier(frontmatter)
  } catch {
    return 'community'
  }
}

export async function list(): Promise<void> {
  const cwd = process.cwd();
  const skillsBase = resolveSkillsDir(cwd);
  const registry = new MemberRegistry();

  const byCategory = new Map<string, typeof members>();
  const members = registry.list();
  for (const m of members) {
    const group = byCategory.get(m.category) ?? [];
    group.push(m);
    byCategory.set(m.category, group);
  }

  console.log('\n\u{1F3DB}️  The Society — Member Status\n');

  const categoryLabels: Record<string, string> = {
    engineering: 'Engineering',
    validation: 'Validation',
    knowledge: 'Knowledge',
    lifecycle: 'Lifecycle',
  };

  for (const [cat, group] of byCategory) {
    console.log(`  ${categoryLabels[cat] ?? cat}:`);
    for (const m of group) {
      const active = existsSync(join(skillsBase, m.name, `${m.name}.md`));
      const status = active ? '✅' : '⬜';
      const skillPath = join(skillsBase, m.name, 'SKILL.md');
      const tier = readTier(skillPath);
      const badge = TIER_BADGES[tier];
      const provider = m.preferredProvider.padEnd(10);
      const perm = m.permissionProfile.padEnd(12);
      console.log(`    ${status}  ${badge} ${m.name.padEnd(16)} ${m.tagline.padEnd(34)} ${perm} ${provider}`);
    }
    console.log();
  }

  console.log('  Columns: Status · Tier · Member · Tagline · Permission · Preferred Provider');
  console.log('  Tiers: ⬡ official  ○ community  ◌ experimental\n');
}
