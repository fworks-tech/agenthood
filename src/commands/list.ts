/**
 * agenthood list
 *
 * Lists all members and their activation status in the current project.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MEMBERS = [
  { name: 'the-scribe',    tagline: 'Commits, PRs, changelogs' },
  { name: 'the-architect', tagline: 'Specs, planning, ADRs' },
  { name: 'the-reviewer',  tagline: 'Five-axis code review' },
  { name: 'the-tester',    tagline: 'TDD and test generation' },
  { name: 'the-debugger',  tagline: 'Root cause analysis' },
  { name: 'the-auditor',   tagline: 'Security and dependencies' },
  { name: 'the-herald',    tagline: 'Releases and versioning' },
  { name: 'the-librarian', tagline: 'Documentation and ADRs' },
  { name: 'the-doorman',   tagline: 'Validation and enforcement' },
] as const;

export async function list(): Promise<void> {
  const cwd = process.cwd();
  const skillsBase = existsSync(join(cwd, '.claude'))
    ? join(cwd, '.claude', 'skills')
    : existsSync(join(cwd, '.codebuddy'))
    ? join(cwd, '.codebuddy', 'skills')
    : join(cwd, '.agenthood', 'skills');

  console.log('\n🏛️  The Society — Member Status\n');

  for (const { name, tagline } of MEMBERS) {
    const active = existsSync(join(skillsBase, name, `${name}.md`));
    const status = active ? '✅ active  ' : '⬜ inactive';
    console.log(`  ${status}  ${name.padEnd(16)} ${tagline}`);
  }

  console.log();
}
