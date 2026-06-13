/**
 * agenthood list
 *
 * Lists all members and their activation status in the current project.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_MEMBERS, resolveSkillsDir } from '../members.js';

export async function list(): Promise<void> {
  const cwd = process.cwd();
  const skillsBase = resolveSkillsDir(cwd);

  console.log('\n\u{1F3DB}️  The Society — Member Status\n');

  for (const { name, tagline } of ALL_MEMBERS) {
    const active = existsSync(join(skillsBase, name, `${name}.md`));
    const status = active ? '✅ active  ' : '⬜ inactive';
    console.log(`  ${status}  ${name.padEnd(16)} ${tagline}`);
  }

  console.log();
}
