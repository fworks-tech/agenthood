#!/usr/bin/env node
/**
 * Agenthood CLI — npx agenthood <command>
 *
 * The Society's command-line interface. Entry point for all
 * initiation, activation, and health check operations.
 */

import 'dotenv/config'
import { parseArgs } from 'node:util';
import { ALL_MEMBERS } from './members.js';
import { init } from './commands/init.js';
import { check } from './commands/check.js';
import { activate } from './commands/activate.js';
import { deactivate } from './commands/deactivate.js';
import { list } from './commands/list.js';
import { oath } from './commands/oath.js';
import { eject } from './commands/eject.js';
import { setup } from './commands/setup.js';
import { run } from './commands/run.js';
import { prSync } from './commands/prSync.js';
import { verify } from './commands/verify.js';
import { rollback } from './commands/rollback.js';
import { status } from './commands/status.js';
import { workflow } from './commands/workflow.js';

const COMMANDS: Record<string, (...args: string[]) => Promise<void>> = {
  init: async () => init(),
  check: async () => check(),
  list: async () => list(),
  oath: async () => oath(),
  eject: async () => eject(),
  setup: async () => setup(),
  verify: async (...args) => verify(args),
  rollback: async (...args) => rollback(args),
  status: async (...args) => status(args),
  workflow: async (...args) => workflow(args),
};

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    args: process.argv.slice(2),
    options: {
      detect: { type: 'boolean', default: false },
      provider: { type: 'string', default: undefined },
    },
  });

  const [command, ...args] = positionals;

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (command === 'activate') {
    await activate(args[0]);
    return;
  }

  if (command === 'deactivate') {
    await deactivate(args[0]);
    return;
  }

  if (command === 'run') {
    const forwarded: string[] = [...args]
    if (values.detect) forwarded.push('--detect')
    if (values.provider) forwarded.push('--provider', values.provider)
    await run(forwarded);
    return;
  }

  if (command === 'pr-sync') {
    await prSync(args);
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`\nUnknown command: "${command}"\n`);
    printHelp();
    process.exit(1);
  }

  await handler(...args);
}

function printHelp(): void {
  console.log(`
🏛️  Agenthood — The Society's CLI

Usage:
  npx agenthood <command>

Commands:
  init                    Initiate the Society in your project
  setup                   Activate hooks and commit template (Agenthood repo)
  check                   Run the Doorman's health check
  activate <member>       Activate a specific member skill
  deactivate <member>     Deactivate a member skill
  run <member> "<task>"   Run a Society member (the-scribe, the-reviewer, …)
                            Use --detect to auto-detect members for the task
                            Use --provider <name> to override the LLM provider
  list                    List all members, their status, permission & provider
  verify [member]         Validate member SKILL.md integrity and lockfile
                            Use --strict for lane overlap checks
                            Use --update-lock to update lockfile hash
  rollback [member]       Restore member SKILL.md from lockfile
                            Use --dry-run to preview without restoring
  status                  Show project health and member metrics
                            Use --watch to poll every 5 seconds
                            Use --json for machine-readable output
                            Use --drift to detect SKILL.md drift vs lockfile
  workflow <name>         Execute a workflow (e.g. review-pr)
  pr-sync                 Sync PR body and post comment for new commits
  oath                    Print the Society's oath
  eject                   Remove the Society from your project

Members:\n${ALL_MEMBERS.map(({ name, tagline }) => `  ${name.padEnd(20)} ${tagline}`).join('\n')}

Examples:
  npx agenthood init
  npx agenthood activate the-scribe
  npx agenthood check
  npx agenthood verify
  npx agenthood status --watch
  npx agenthood rollback the-scribe --dry-run
  npx agenthood workflow review-pr
  npx agenthood oath

The Society maintains impeccable standards.
Zero tolerance for 'fix stuff' commits.
`);
}

main().catch((err) => {
  console.error('The Society encountered an unexpected error:', err);
  process.exit(1);
});
