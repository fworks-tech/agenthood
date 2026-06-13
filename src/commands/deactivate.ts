/**
 * agenthood deactivate <member>
 *
 * Removes a member's skill file from the project's active skills directory.
 */

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.js';

export async function deactivate(member?: string): Promise<void> {
  if (!member) {
    console.error('\nUsage: npx agenthood deactivate <member>\n');
    process.exit(1);
  }

  if (!MEMBER_NAMES.includes(member)) {
    console.error(`\nUnknown member: "${member}"`);
    console.error('Available members:', MEMBER_NAMES.join(', '));
    process.exit(1);
  }

  const cwd = process.cwd();
  const skillsBase = resolveSkillsDir(cwd);

  const skillFile = join(skillsBase, member, `${member}.md`);

  if (!existsSync(skillFile)) {
    console.log(`\n\u26a0\ufe0f  ${member} is not currently active.\n`);
    return;
  }

  await rm(skillFile);
  console.log(`\n\u2705 ${member} has been deactivated.\n`);
  console.log('  The Society notes your preference.\n');
}
