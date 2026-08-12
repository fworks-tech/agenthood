/**
 * agenthood deactivate <member>
 *
 * The Envoy — removes a member's skill file from the project's active skills directory.
 */

import { rm } from 'node:fs/promises';
import type { CommandDescriptor } from './types.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSkillsDir } from '../members.js';
import { requireMember } from './memberArg.js';

export const command: CommandDescriptor = {
  name: 'deactivate',
  description: 'Deactivate a member skill',
  handler: (args) => deactivate(args[0]),
}

export async function deactivate(member?: string): Promise<void> {
  member = requireMember(member, 'deactivate')

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
