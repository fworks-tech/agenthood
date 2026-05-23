/**
 * agenthood check
 *
 * The Doorman's health check. Verifies that the Initiation
 * is complete and all standards are in place.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

export async function check(): Promise<void> {
  const cwd = process.cwd();
  const results: CheckResult[] = [];

  const file = (label: string, path: string) =>
    results.push({ label, pass: existsSync(join(cwd, path)) });

  const cmd = (label: string, command: string) => {
    try {
      execSync(command, { cwd, stdio: 'pipe' });
      results.push({ label, pass: true });
    } catch {
      results.push({ label, pass: false });
    }
  };

  // Conventions
  file('.gitmessage configured', '.gitmessage');
  file('commitlint.config.js present', 'commitlint.config.js');

  // Hooks
  file('Husky commit-msg hook active', '.husky/commit-msg');
  file('Husky pre-push hook active', '.husky/pre-push');

  // GitHub templates
  file('.github/pull_request_template.md present', '.github/pull_request_template.md');
  file('.github/ISSUE_TEMPLATE/bug_report.md present', '.github/ISSUE_TEMPLATE/bug_report.md');
  file('.github/ISSUE_TEMPLATE/feature_request.md present', '.github/ISSUE_TEMPLATE/feature_request.md');

  // CI workflows
  file('.github/workflows/commitlint.yml present', '.github/workflows/commitlint.yml');
  file('.github/workflows/pr-title.yml present', '.github/workflows/pr-title.yml');

  // Skills
  const members = [
    'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
    'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
  ];
  const skillsBase = existsSync(join(cwd, '.claude'))
    ? '.claude/skills'
    : existsSync(join(cwd, '.codebuddy'))
    ? '.codebuddy/skills'
    : '.agenthood/skills';

  const installedCount = members.filter((m) =>
    existsSync(join(cwd, skillsBase, m, `${m}.md`)),
  ).length;

  results.push({
    label: `Member skills installed (${installedCount}/${members.length})`,
    pass: installedCount === members.length,
  });

  // Git template
  cmd('git commit.template configured', 'git config --get commit.template');

  // AGENTS.md
  file('AGENTS.md present', 'AGENTS.md');

  // Report
  const passing = results.filter((r) => r.pass).length;
  const failing = results.filter((r) => !r.pass).length;

  console.log('\n🏛️  Agenthood Health Check\n');

  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}`);
  }

  console.log(`\n  ${passing} passing · ${failing} failing\n`);

  if (failing === 0) {
    console.log('  The Society is ready. You may proceed.\n');
  } else {
    console.log('  Run `npx agenthood init` to complete the initiation.\n');
    process.exit(1);
  }
}
