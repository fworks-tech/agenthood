import { rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MEMBER_NAMES } from '../members.js';
import { RUNTIME_SKILL_DIRS } from '../init/setup.js';
import type { CommandDescriptor } from './types.js';

export const command: CommandDescriptor = {
  name: 'eject',
  description: 'Remove the Society from your project',
  handler: () => eject(),
}

// Skills dirs init may have populated for a non-agenthood runtime. Only the
// member subdirs are removed — foreign user skills are never touched. The
// .agenthood/skills variant dies with .agenthood itself.
const RUNTIME_SKILL_DIRS_EXCLUDING_AGENTHOOD = Object.values(RUNTIME_SKILL_DIRS)
  .filter((dir) => !dir.endsWith('.agenthood/skills'))

function memberSubdirs(dir: string): string[] {
  return readdirSync(dir).filter((entry) => MEMBER_NAMES.includes(entry))
}

export async function eject(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Ejecting the Society...\n');
  console.log('  The Society notes that your commits were better while you were a member.\n');

  const toRemove = ['.agenthood', 'AGENTS.md'];
  const skillSubdirs: string[] = [];

  for (const dir of RUNTIME_SKILL_DIRS_EXCLUDING_AGENTHOOD) {
    const full = join(cwd, dir);
    if (!existsSync(full)) continue;
    for (const sub of memberSubdirs(full)) {
      skillSubdirs.push(join(dir, sub));
    }
  }

  for (const path of [...toRemove, ...skillSubdirs]) {
    const full = join(cwd, path);
    if (existsSync(full)) {
      await rm(full, { recursive: true });
      console.log(`  Removed: ${path}`);
    }
  }

  console.log('\n  The Society has left the building.\n');
  console.log('  Run `npx agenthood init` to return to the fold.\n');
}
