/**
 * agenthood activate <member>
 *
 * The Envoy — bootstraps a member's skill file into the project's active skills directory.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import type { CommandDescriptor } from './types.js';
import { requireMember } from './memberArg.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOCIETY_ROOT = join(__dirname, '..', '..');

export const command: CommandDescriptor = {
  name: 'activate',
  description: 'Activate a specific member skill',
  handler: (args) => activate(args[0]),
}

export async function activate(member?: string): Promise<void> {
  member = requireMember(member, 'activate')

  const cwd = process.cwd();
  const skillsDest = resolveSkillsDir(cwd);

  const destDir = join(skillsDest, member);
  await mkdir(destDir, { recursive: true });

  const src = join(SOCIETY_ROOT, 'skills', member, 'SKILL.md');
  const dest = join(destDir, `${member}.md`);

  await copyFile(src, dest);

  console.log(`\n✅ ${member} is now active.\n`);
}
