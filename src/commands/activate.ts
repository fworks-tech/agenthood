/**
 * agenthood activate <member>
 *
 * Copies a member's skill file into the project's active skills directory.
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOCIETY_ROOT = join(__dirname, '..', '..');

const ALL_MEMBERS = [
  'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
  'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
];

export async function activate(member?: string): Promise<void> {
  if (!member) {
    console.error('\nUsage: npx agenthood activate <member>\n');
    console.error('Members:', ALL_MEMBERS.join(', '));
    process.exit(1);
  }

  if (!ALL_MEMBERS.includes(member)) {
    console.error(`\nUnknown member: "${member}"`);
    console.error('Available members:', ALL_MEMBERS.join(', '));
    process.exit(1);
  }

  const cwd = process.cwd();
  const skillsDest = existsSync(join(cwd, '.claude'))
    ? join(cwd, '.claude', 'skills')
    : existsSync(join(cwd, '.codebuddy'))
    ? join(cwd, '.codebuddy', 'skills')
    : join(cwd, '.agenthood', 'skills');

  const destDir = join(skillsDest, member);
  await mkdir(destDir, { recursive: true });

  const src = join(SOCIETY_ROOT, 'members', member, `${member}.md`);
  const dest = join(destDir, `${member}.md`);

  await copyFile(src, dest);

  console.log(`\n✅ ${member} is now active.\n`);
}
