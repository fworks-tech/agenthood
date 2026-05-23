/**
 * agenthood deactivate <member>
 *
 * Removes a member's skill file from the project's active skills directory.
 */

import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function deactivate(member?: string): Promise<void> {
  if (!member) {
    console.error('\nUsage: npx agenthood deactivate <member>\n');
    process.exit(1);
  }

  const cwd = process.cwd();
  const skillsBase = existsSync(join(cwd, '.claude'))
    ? join(cwd, '.claude', 'skills')
    : existsSync(join(cwd, '.codebuddy'))
    ? join(cwd, '.codebuddy', 'skills')
    : join(cwd, '.agenthood', 'skills');

  const skillFile = join(skillsBase, member, `${member}.md`);

  if (!existsSync(skillFile)) {
    console.log(`\n⚠️  ${member} is not currently active.\n`);
    return;
  }

  await rm(skillFile);
  console.log(`\n✅ ${member} has been deactivated.\n`);
  console.log('  The Society notes your preference.\n');
}
