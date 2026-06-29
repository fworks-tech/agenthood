/**
 * agenthood list
 *
 * Lists all Society members and their activation status in the current
 * project. Uses the canonical MemberRegistry so it stays in sync with the
 * tool scopes and permission profiles in docs/architecture/built-in-tools.md.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MemberRegistry } from '../members/MemberRegistry.ts';
import { resolveSkillsDir } from '../members.ts';

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
      const provider = m.preferredProvider.padEnd(10);
      const perm = m.permissionProfile.padEnd(12);
      console.log(`    ${status}  ${m.name.padEnd(16)} ${m.tagline.padEnd(34)} ${perm} ${provider}`);
    }
    console.log();
  }

  console.log('  Columns: Status · Member · Tagline · Permission · Preferred Provider\n');
}
