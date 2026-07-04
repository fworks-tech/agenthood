import { rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export async function eject(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Ejecting the Society...\n');
  console.log('  The Society notes that your commits were better while you were a member.\n');

  const toRemove = [
    '.gitmessage',
    'commitlint.config.ts',

    '.githooks/commit-msg',
    '.githooks/pre-commit',
    '.githooks/pre-push',

    '.github/pull_request_template.md',
    '.github/COMMIT_CONVENTION.md',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',

    '.github/workflows/commitlint.yml',

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

  try {
    execSync('git config --unset commit.template', { cwd, stdio: 'pipe' });
    console.log('  Removed: git commit.template config');
  } catch {
    // already unset
  }

  try {
    execSync('git config --unset core.hooksPath', { cwd, stdio: 'pipe' });
    console.log('  Removed: git core.hooksPath config');
  } catch {
    // already unset
  }

  console.log('\n  The Society has left the building.\n');
  console.log('  Run `npx agenthood init` to return to the fold.\n');
}
