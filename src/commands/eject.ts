import { rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MEMBER_NAMES } from '../members.js';
import type { CommandDescriptor } from './types.js';

export const command: CommandDescriptor = {
  name: 'eject',
  description: 'Remove the Society from your project',
  handler: () => eject(),
}

// Skills dirs init may have populated for a non-agenthood runtime. The
// .agenthood/skills variant dies with .agenthood itself.
const RUNTIME_SKILL_DIRS = ['.claude/skills', '.github/skills', '.gemini/skills']

function isAgenthoodSkillsDir(dir: string): boolean {
  return readdirSync(dir).some((entry) => MEMBER_NAMES.includes(entry))
}

export async function eject(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Ejecting the Society...\n');
  console.log('  The Society notes that your commits were better while you were a member.\n');

  const toRemove = [
    '.agenthood',
    'AGENTS.md',
    ...RUNTIME_SKILL_DIRS.filter((dir) => {
      const full = join(cwd, dir);
      return existsSync(full) && isAgenthoodSkillsDir(full);
    }),
  ];

  for (const path of toRemove) {
    const full = join(cwd, path);
    if (existsSync(full)) {
      await rm(full, { recursive: true });
      console.log(`  Removed: ${path}`);
    }
  }

  console.log('\n  The Society has left the building.\n');
  console.log('  Run `npx agenthood init` to return to the fold.\n');
}
