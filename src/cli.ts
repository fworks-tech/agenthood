#!/usr/bin/env node
/**
 * Agenthood CLI — npx agenthood <command>
 *
 * The Society's command-line interface. Entry point for all
 * initiation, activation, and health check operations.
 *
 * Commands are auto-discovered from ./commands/ — each command file exports
 * a `command` CommandDescriptor (name, handler, aliases). Adding a command
 * means adding a file, not touching this one.
 */

import 'dotenv/config'

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ALL_MEMBERS } from './members.js';
import type { CommandDescriptor } from './commands/types.js';

async function discoverCommands(): Promise<Record<string, CommandDescriptor>> {
  const commandsDir = join(dirname(fileURLToPath(import.meta.url)), 'commands');
  const files = readdirSync(commandsDir)
    .filter((f) => /\.(js|ts)$/.test(f) && !f.endsWith('.d.ts'))
    .sort();
  const registry: Record<string, CommandDescriptor> = {};
  for (const file of files) {
    const mod = await import(pathToFileURL(join(commandsDir, file)).href);
    const desc = mod.command as CommandDescriptor | undefined;
    if (!desc?.name || typeof desc.handler !== 'function') continue;
    registry[desc.name] = desc;
    for (const alias of desc.aliases ?? []) registry[alias] = desc;
  }
  return registry;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  const cmdIndex = rawArgs.findIndex((a) => !a.startsWith('-'));
  const command = cmdIndex >= 0 ? rawArgs[cmdIndex] : undefined;
  const args = rawArgs.filter((_, i) => i !== cmdIndex);

  if (!command || command === 'help') {
    printHelp();
    process.exit(0);
  }

  const handler = (await discoverCommands())[command];
  if (!handler) {
    console.error(`\nUnknown command: "${command}"\n`);
    printHelp();
    process.exit(1);
  }

  await handler.handler(args);
}

const HELP_TEXT = `
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
                            Use --member <name> for per-member trace summaries
  trace                   List recent member invocation traces
                            Use --member <name>, --limit <n>, --since <time>
                            Use --json for machine-readable output
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
`;

function printHelp(): void {
  console.log(HELP_TEXT);
}

main().catch((err) => {
  console.error('The Society encountered an unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
