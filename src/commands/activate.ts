/**
 * agenthood activate <member>
 *
 * Copies a member's skill file into the project's active skills directory.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOCIETY_ROOT = join(__dirname, '..', '..');

export async function activate(member?: string): Promise<void> {
  if (!member) {
    console.error('\nUsage: npx agenthood activate <member>\n');
    console.error('Members:', MEMBER_NAMES.join(', '));
    process.exit(1);
  }

  if (!MEMBER_NAMES.includes(member)) {
    console.error(`\nUnknown member: "${member}"`);
    console.error('Available members:', MEMBER_NAMES.join(', '));
    process.exit(1);
  }

  const cwd = process.cwd();
  const skillsDest = resolveSkillsDir(cwd);

  const destDir = join(skillsDest, member);
  await mkdir(destDir, { recursive: true });

  const src = join(SOCIETY_ROOT, 'members', member, 'SKILL.md');
  const dest = join(destDir, `${member}.md`);

  await copyFile(src, dest);

  console.log(`\n✅ ${member} is now active.\n`);
}
