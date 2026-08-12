import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandDescriptor } from './types.js';

export const command: CommandDescriptor = {
  name: 'eject',
  description: 'Remove the Society from your project',
  handler: () => eject(),
}

export async function eject(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Ejecting the Society...\n');
  console.log('  The Society notes that your commits were better while you were a member.\n');

  const toRemove = [
    '.agenthood',
    'AGENTS.md',
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
