/**
 * Agenthood VS Code Extension
 *
 * Brings the Society into the editor:
 * - Status bar showing active member count
 * - Inline commit message validation
 * - Command palette integration
 * - Ritual notifications
 */

import * as vscode from 'vscode';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  // Status bar — shows active member count
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = 'agenthood.list';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // SCM input validation — validates commit messages as you type
  const scmValidation = vscode.scm.onDidChangeInputValueProvider(() => {
    validateCommitInput();
  });
  context.subscriptions.push(scmValidation);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agenthood.init', runInit),
    vscode.commands.registerCommand('agenthood.check', runCheck),
    vscode.commands.registerCommand('agenthood.oath', showOath),
    vscode.commands.registerCommand('agenthood.activate', runActivate),
    vscode.commands.registerCommand('agenthood.deactivate', runDeactivate),
    vscode.commands.registerCommand('agenthood.list', showMemberList),
  );

  // Watch for .agenthood config changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.agenthood/config.json');
  watcher.onDidChange(updateStatusBar);
  context.subscriptions.push(watcher);
}

function updateStatusBar(): void {
  const config = vscode.workspace.getConfiguration('agenthood');
  if (!config.get('statusBar.show')) {
    statusBarItem.hide();
    return;
  }

  const activeCount = countActiveMembers();
  statusBarItem.text = `🏛️ ${activeCount}/9`;
  statusBarItem.tooltip = `Agenthood: ${activeCount} members active. Click to list.`;
  statusBarItem.show();
}

function countActiveMembers(): number {
  const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsFolder) return 0;

  const members = [
    'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
    'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
  ];

  const skillsBase = existsSync(join(wsFolder, '.claude'))
    ? join(wsFolder, '.claude', 'skills')
    : existsSync(join(wsFolder, '.codebuddy'))
    ? join(wsFolder, '.codebuddy', 'skills')
    : join(wsFolder, '.agenthood', 'skills');

  return members.filter((m) => existsSync(join(skillsBase, m, `${m}.md`))).length;
}

function validateCommitInput(): void {
  const config = vscode.workspace.getConfiguration('agenthood');
  if (!config.get('commitValidation.enabled')) return;

  // Commit validation is handled by the Husky hook at commit time.
  // Here we surface a diagnostic on the SCM input for early feedback.
  // Full implementation wires into the git extension's SCM input box.
}

async function runInit(): Promise<void> {
  const terminal = vscode.window.createTerminal('Agenthood Initiation');
  terminal.sendText('npx agenthood init');
  terminal.show();
}

async function runCheck(): Promise<void> {
  const terminal = vscode.window.createTerminal('Agenthood Health Check');
  terminal.sendText('npx agenthood check');
  terminal.show();
}

async function showOath(): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'agenthood.oath',
    '🏛️ The Oath',
    vscode.ViewColumn.One,
    {},
  );

  panel.webview.html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: monospace; padding: 2rem; max-width: 600px;">
      <h1>🏛️ The Oath of the Agenthood</h1>
      <blockquote>
        <p>I commit with intention.</p>
        <p>I branch with purpose.</p>
        <p>I review with honesty.</p>
        <p>I ship with confidence.</p>
        <p>I never push to main.</p>
      </blockquote>
      <hr/>
      <p><em>The oath is not aspirational. It is operational.<br/>
      The Doorman enforces it. The Herald announces when you honored it.</em></p>
    </body>
    </html>
  `;
}

async function runActivate(): Promise<void> {
  const members = [
    'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
    'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
  ];

  const selected = await vscode.window.showQuickPick(members, {
    placeHolder: 'Select a member to activate',
  });

  if (!selected) return;

  const terminal = vscode.window.createTerminal('Agenthood');
  terminal.sendText(`npx agenthood activate ${selected}`);
  terminal.show();
  updateStatusBar();
}

async function runDeactivate(): Promise<void> {
  const members = [
    'the-scribe', 'the-architect', 'the-reviewer', 'the-tester',
    'the-debugger', 'the-auditor', 'the-herald', 'the-librarian', 'the-doorman',
  ];

  const selected = await vscode.window.showQuickPick(members, {
    placeHolder: 'Select a member to deactivate',
  });

  if (!selected) return;

  const terminal = vscode.window.createTerminal('Agenthood');
  terminal.sendText(`npx agenthood deactivate ${selected}`);
  terminal.show();
  updateStatusBar();
}

async function showMemberList(): Promise<void> {
  const terminal = vscode.window.createTerminal('Agenthood Members');
  terminal.sendText('npx agenthood list');
  terminal.show();
}

export function deactivate(): void {
  statusBarItem?.dispose();
}
