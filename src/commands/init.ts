/**
 * agenthood init
 *
 * The Initiation ceremony. Installs conventions, hooks, templates,
 * and member skills into the target project.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOCIETY_ROOT = join(__dirname, '..', '..');

export async function init(): Promise<void> {
  const cwd = process.cwd();

  console.log('\n🏛️  Welcome to the Agenthood.\n');
  console.log('The Initiation is beginning.\n');

  const steps = [
    ['Conventions', () => installConventions(cwd)],
    ['Git hooks (Husky)', () => installHooks(cwd)],
    ['GitHub templates', () => installGitHubTemplates(cwd)],
    ['CI workflows', () => installWorkflows(cwd)],
    ['Member skills', () => installSkills(cwd)],
    ['Git commit template', () => configureGitTemplate(cwd)],
  ] as const;

  for (const [label, step] of steps) {
    process.stdout.write(`  Installing ${label}...`);
    try {
      await step();
      console.log(' ✅');
    } catch (err) {
      console.log(' ❌');
      console.error(`    Failed: ${err}`);
    }
  }

  console.log('\n🏛️  The Society is ready.\n');
  console.log('  Run `npx agenthood check` to verify the initiation.');
  console.log('  Run `npx agenthood oath` to read the oath.\n');
  console.log('  Your next commit will be reviewed by The Doorman.\n');
}

async function installConventions(cwd: string): Promise<void> {
  await copyFile(
    join(SOCIETY_ROOT, 'conventions', '.gitmessage'),
    join(cwd, '.gitmessage'),
  );
  await copyFile(
    join(SOCIETY_ROOT, 'conventions', 'commitlint.config.js'),
    join(cwd, 'commitlint.config.js'),
  );
}

async function installHooks(cwd: string): Promise<void> {
  execSync('npm install --save-dev husky @commitlint/cli @commitlint/config-conventional', {
    cwd,
    stdio: 'pipe',
  });
  execSync('npx husky init', { cwd, stdio: 'pipe' });

  const huskyDir = join(cwd, '.husky');
  await writeFile(
    join(huskyDir, 'commit-msg'),
    'npx --no -- commitlint --edit $1\n',
    'utf8',
  );
  await writeFile(
    join(huskyDir, 'pre-push'),
    '# Run tests and lint before push\nnpm test && npm run lint\n',
    'utf8',
  );
}

async function installGitHubTemplates(cwd: string): Promise<void> {
  const githubDir = join(cwd, '.github');
  const issueTemplateDir = join(githubDir, 'ISSUE_TEMPLATE');

  await mkdir(issueTemplateDir, { recursive: true });
  await mkdir(join(githubDir, 'workflows'), { recursive: true });

  // PR template
  await writeFile(
    join(githubDir, 'pull_request_template.md'),
    PR_TEMPLATE,
    'utf8',
  );

  // Issue templates
  await writeFile(
    join(issueTemplateDir, 'bug_report.md'),
    BUG_TEMPLATE,
    'utf8',
  );
  await writeFile(
    join(issueTemplateDir, 'feature_request.md'),
    FEATURE_TEMPLATE,
    'utf8',
  );

  // Commit convention reference
  await copyFile(
    join(SOCIETY_ROOT, 'conventions', 'COMMIT_CONVENTION.md'),
    join(githubDir, 'COMMIT_CONVENTION.md'),
  );
}

async function installWorkflows(cwd: string): Promise<void> {
  const workflowsDir = join(cwd, '.github', 'workflows');
  await mkdir(workflowsDir, { recursive: true });

  for (const workflow of ['commitlint.yml', 'pr-title.yml']) {
    const src = join(SOCIETY_ROOT, 'workflows', workflow);
    const dest = join(workflowsDir, workflow);
    if (!existsSync(dest)) {
      await copyFile(src, dest);
    }
  }
}

async function installSkills(cwd: string): Promise<void> {
  // Detect runtime: Claude Code takes priority, then CodeBuddy, then generic
  const isClaudeCode = existsSync(join(cwd, '.claude'));
  const isCodeBuddy = existsSync(join(cwd, '.codebuddy'));

  const skillsDest = isClaudeCode
    ? join(cwd, '.claude', 'skills')
    : isCodeBuddy
    ? join(cwd, '.codebuddy', 'skills')
    : join(cwd, '.agenthood', 'skills');

  await mkdir(skillsDest, { recursive: true });

  const members = [
    'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
    'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
  ];

  for (const member of members) {
    const src = join(SOCIETY_ROOT, 'members', member, `${member}.md`);
    const destDir = join(skillsDest, member);
    await mkdir(destDir, { recursive: true });
    await copyFile(src, join(destDir, `${member}.md`));
  }

  // Copy AGENTS.md to project root
  if (!existsSync(join(cwd, 'AGENTS.md'))) {
    await copyFile(join(SOCIETY_ROOT, 'AGENTS.md'), join(cwd, 'AGENTS.md'));
  }
}

async function configureGitTemplate(cwd: string): Promise<void> {
  execSync('git config commit.template .gitmessage', { cwd, stdio: 'pipe' });
}

const PR_TEMPLATE = `## What changed

## Why

## How to test

1.
2.

## Screenshots (if UI change)

Closes #
`;

const BUG_TEMPLATE = `---
name: Bug report
about: Something is broken
labels: bug
---

## Summary

What went wrong?

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

- OS:
- Browser/Runtime:
- Version:

## Related

-
`;

const FEATURE_TEMPLATE = `---
name: Feature request
about: A new capability or improvement
labels: feature
---

## Problem

What user need or pain does this address?

## Proposed Solution

What should be built?

## Acceptance Criteria

- [ ]
- [ ]

## Out of Scope

## Related

-
`;
