import * as vscode from 'vscode';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTHOOD_MEMBERS } from './members.js';
import { ObserverService } from './observer.js';
import { AuditorService } from './auditorService.js';
import { DoormanService } from './doormanService.js';
import { LibrarianService } from './librarianService.js';
import { MemberWatchProvider } from './memberWatchProvider.js';
import { ReviewerService } from './reviewerService.js';
import { disposeDiagnostics } from './diagnostics.js';

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;
export let observerService!: ObserverService;

let doormanService: DoormanService;
let memberWatchProvider: MemberWatchProvider;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Agenthood');
  observerService = new ObserverService(context);

  // v1.4.0 — The Living Editor services
  doormanService = new DoormanService();
  doormanService.activate();

  const auditorService = new AuditorService(observerService);
  auditorService.activate();

  const librarianService = new LibrarianService(observerService);
  librarianService.activate();

  const reviewerService = new ReviewerService();
  reviewerService.activate(context);

  memberWatchProvider = new MemberWatchProvider(observerService);
  vscode.window.registerTreeDataProvider('agenthood.membersWatch', memberWatchProvider);

  // Status bar — shows active member count
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'agenthood.list';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agenthood.init', runInit),
    vscode.commands.registerCommand('agenthood.check', runCheck),
    vscode.commands.registerCommand('agenthood.oath', showOath),
    vscode.commands.registerCommand('agenthood.activate', runActivate),
    vscode.commands.registerCommand('agenthood.deactivate', runDeactivate),
    vscode.commands.registerCommand('agenthood.list', showMemberList),
    vscode.commands.registerCommand('agenthood.refreshMembers', () => memberWatchProvider.refresh()),
    vscode.commands.registerCommand('agenthood.invokeMember', () => {
      vscode.window.showInformationMessage('Member invocation via autonomous runtime — coming in v2.0.0.');
    }),
  );

  // Watch for .agenthood config changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.agenthood/config.json');
  watcher.onDidChange(updateStatusBar);
  context.subscriptions.push(watcher);

  return { observerService };
}

function updateStatusBar(): void {
  const config = vscode.workspace.getConfiguration('agenthood');
  if (!config.get('statusBar.show')) {
    statusBarItem.hide();
    return;
  }

  const activeCount = getMembersBySkillPath().length;
  const totalMembers = AGENTHOOD_MEMBERS.length;
  statusBarItem.text = `🏛️ ${activeCount}/${totalMembers}`;
  statusBarItem.tooltip = `Agenthood: ${activeCount}/${totalMembers} members active. Click to list.`;
  statusBarItem.show();
}

function getSkillsBasePath(): string | null {
  const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsFolder) return null;

  if (existsSync(join(wsFolder, '.claude', 'skills'))) return join(wsFolder, '.claude', 'skills');
  if (existsSync(join(wsFolder, '.codebuddy', 'skills'))) return join(wsFolder, '.codebuddy', 'skills');
  if (existsSync(join(wsFolder, '.github', 'skills'))) return join(wsFolder, '.github', 'skills');
  return join(wsFolder, '.agenthood', 'skills');
}

function getMembersBySkillPath(): string[] {
  const skillsBase = getSkillsBasePath();
  if (!skillsBase) return [];

  return AGENTHOOD_MEMBERS.filter((member) =>
    existsSync(join(skillsBase, member, `${member}.md`)),
  );
}

async function runTerminalCommand(
  command: string,
  title: string,
): Promise<void> {
  try {
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Running: ${command}`);

    const terminal = vscode.window.createTerminal(title);
    terminal.sendText(command);
    terminal.show();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`[ERROR] ${message}`);
    vscode.window.showErrorMessage(`Agenthood: Failed to run command. Check output for details.`);
  }
}

async function runInit(): Promise<void> {
  await runTerminalCommand('npx agenthood init', 'Agenthood Initiation');
}

async function runCheck(): Promise<void> {
  await runTerminalCommand('npx agenthood check', 'Agenthood Health Check');
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
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>The Oath of the Agenthood</title>
      <style>
        body {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
          color: #e0e0e0;
          background: #1e1e1e;
        }
        h1 {
          color: #4ec9b0;
          margin-bottom: 1rem;
        }
        blockquote {
          border-left: 3px solid #4ec9b0;
          padding-left: 1rem;
          margin: 1.5rem 0;
          font-style: italic;
          color: #9cdcfe;
        }
        blockquote p {
          margin: 0.5rem 0;
        }
        hr {
          border: none;
          border-top: 1px solid #404040;
          margin: 2rem 0;
        }
        em {
          color: #ce9178;
        }
      </style>
    </head>
    <body>
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
  const inactiveMembers = AGENTHOOD_MEMBERS.filter(
    (m) => !getMembersBySkillPath().includes(m),
  );

  if (inactiveMembers.length === 0) {
    vscode.window.showInformationMessage('All members are already active!');
    return;
  }

  const selected = await vscode.window.showQuickPick(inactiveMembers, {
    placeHolder: 'Select a member to activate',
  });

  if (!selected) return;

  await runTerminalCommand(
    `npx agenthood activate ${selected}`,
    'Agenthood Activate Member',
  );
  updateStatusBar();
}

async function runDeactivate(): Promise<void> {
  const activeMembers = getMembersBySkillPath();

  if (activeMembers.length === 0) {
    vscode.window.showInformationMessage('No active members to deactivate.');
    return;
  }

  const selected = await vscode.window.showQuickPick(activeMembers, {
    placeHolder: 'Select a member to deactivate',
  });

  if (!selected) return;

  await runTerminalCommand(
    `npx agenthood deactivate ${selected}`,
    'Agenthood Deactivate Member',
  );
  updateStatusBar();
}

async function showMemberList(): Promise<void> {
  await runTerminalCommand('npx agenthood list', 'Agenthood Members');
}

export function deactivate(): void {
  doormanService?.dispose();
  memberWatchProvider?.dispose();
  disposeDiagnostics();
  statusBarItem?.dispose();
  outputChannel?.dispose();
}
