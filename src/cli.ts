#!/usr/bin/env node
/**
 * Agenthood CLI — npx agenthood <command>
 *
 * The Society's command-line interface. Entry point for all
 * initiation, activation, and health check operations.
 */

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

const COMMANDS: Record<string, () => Promise<void>> = {
  init,
  check,
  list,
  oath,
  eject,
  setup,
};

async function main(): Promise<void> {
  const { positionals } = parseArgs({
    allowPositionals: true,
    args: process.argv.slice(2),
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

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`\nUnknown command: "${command}"\n`);
    printHelp();
    process.exit(1);
  }

  await handler();
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
  list                    List all members and their status
  oath                    Print the Society's oath
  eject                   Remove the Society from your project

Members:\n${ALL_MEMBERS.map(({ name, tagline }) => `  ${name.padEnd(20)} ${tagline}`).join('\n')}

Examples:
  npx agenthood init
  npx agenthood activate the-scribe
  npx agenthood check
  npx agenthood oath

The Society maintains impeccable standards.
Zero tolerance for 'fix stuff' commits.
`);
}

main().catch((err) => {
  console.error('The Society encountered an unexpected error:', err);
  process.exit(1);
});
