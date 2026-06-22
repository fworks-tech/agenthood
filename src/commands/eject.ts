/**
 * agenthood eject
 *
 * The Envoy — removes all Society artifacts from the project cleanly.
 * The Society will not hold it against you.
 */

import { rm } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export async function eject(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Ejecting the Society...\n');
  console.log('  The Society notes that your commits were better while you were a member.\n');

  const toRemove = [
    // Conventions
    '.gitmessage',
    'commitlint.config.ts',

    // Husky hooks
    '.husky/commit-msg',
    '.husky/pre-push',

    // GitHub templates
    '.github/pull_request_template.md',
    '.github/COMMIT_CONVENTION.md',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',

    // CI workflows
    '.github/workflows/commitlint.yml',

    // Society config and skills
    '.agenthood',

    // AGENTS.md installed at project root
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

  removeHuskyFromPackageJson(cwd);

  console.log('\n  The Society has left the building.\n');
  console.log('  Run `npx agenthood init` to return to the fold.\n');
}

function removeHuskyFromPackageJson(cwd: string): void {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return;
  }

  const devDeps = pkg.devDependencies as Record<string, string> | undefined;
  if (!devDeps) return;

  const societyDeps = [
    'husky',
    '@commitlint/cli',
    '@commitlint/config-conventional',
  ];

  const removed: string[] = [];
  for (const dep of societyDeps) {
    if (dep in devDeps) {
      delete devDeps[dep];
      removed.push(dep);
    }
  }

  if (removed.length === 0) return;

  if (Object.keys(devDeps).length === 0) {
    delete pkg.devDependencies;
  }

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  Removed from package.json devDependencies: ${removed.join(', ')}`);
  console.log('  Run `npm install` to update your node_modules.');
}
