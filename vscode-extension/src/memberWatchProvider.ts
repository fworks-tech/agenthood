import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AGENTHOOD_MEMBERS } from './members.js';
import { ObserverService } from './observer.js';

type MemberStatus = 'watching' | 'triggered' | 'not-installed';

const TRIGGER_DURATION_MS = 3000;

const MEMBER_DISPLAY_NAMES: Record<string, string> = {
  'scribe': 'The Scribe',
  'architect': 'The Architect',
  'reviewer': 'The Reviewer',
  'tester': 'The Tester',
  'debugger': 'The Debugger',
  'auditor': 'The Auditor',
  'herald': 'The Herald',
  'librarian': 'The Librarian',
  'doorman': 'The Doorman',
  'oracle': 'The Oracle',
  'envoy': 'The Envoy',
  'sentinel': 'The Sentinel',
  'warden': 'The Warden',
  'steward': 'The Steward',
};

export function getMemberTriggers(memberId: string): RegExp[] {
  const map: Record<string, RegExp[]> = {
    'reviewer': [/\.(ts|js|tsx|jsx|py|go|java|cs)$/],
    'warden': [/\.(ts|js|tsx|jsx|py|go|java|cs)$/],
    'librarian': [/\.md$/],
    'tester': [/\.(test|spec)\.(ts|js|tsx|jsx|py)$/],
    'auditor': [/package\.json$/, /\.lock$/, /\.(ts|js|env)$/],
    'architect': [],
    'sentinel': [/members\/.*\.md$/, /skills\/.*\.md$/],
    'oracle': [/members\/.*\.md$/, /skills\/.*\.md$/],
    'doorman': [/COMMIT_EDITMSG$/, /HEAD$/],
    'scribe': [/COMMIT_EDITMSG$/, /ORIG_HEAD$/],
    'herald': [],
    'debugger': [],
    'envoy': [],
    'steward': [],
  };
  return map[memberId] ?? [];
}

export function getInstalledMembers(workspaceRoot: string): Set<string> {
  const installed = new Set<string>();
  const configPath = path.join(workspaceRoot, '.agenthood', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as { members?: string[] };
    if (Array.isArray(config.members)) {
      config.members.forEach((m) => installed.add(m));
    }
  } catch {
    // Config not found or invalid — treat as none installed
  }
  return installed;
}

export class MemberItem extends vscode.TreeItem {
  constructor(
    public readonly memberId: string,
    public readonly memberStatus: MemberStatus,
  ) {
    super(MEMBER_DISPLAY_NAMES[memberId] ?? memberId, vscode.TreeItemCollapsibleState.None);

    this.contextValue = `member-${memberStatus}`;
    this.tooltip = this.getTooltip(memberStatus);
    this.description = this.getDescription(memberStatus);
    this.iconPath = this.getIcon(memberStatus);
  }

  private getTooltip(status: MemberStatus): string {
    if (status === 'watching') return `${MEMBER_DISPLAY_NAMES[this.memberId]} is watching the workspace`;
    if (status === 'triggered') return `${MEMBER_DISPLAY_NAMES[this.memberId]} just activated`;
    return `${MEMBER_DISPLAY_NAMES[this.memberId]} is not installed`;
  }

  private getDescription(status: MemberStatus): string {
    if (status === 'watching') return 'watching';
    if (status === 'triggered') return 'activated';
    return 'not installed';
  }

  private getIcon(status: MemberStatus): vscode.ThemeIcon {
    if (status === 'triggered') return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.yellow'));
    if (status === 'watching') return new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.green'));
    return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
  }
}

export class MemberWatchProvider implements vscode.TreeDataProvider<MemberItem>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<MemberItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private statuses = new Map<string, MemberStatus>();
  private triggerTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private installedMembers = new Set<string>();
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly observer: ObserverService) {
    this.refreshInstalledMembers();
    this.initStatuses();
    this.registerTriggers();
  }

  private refreshInstalledMembers(): void {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (root) {
      this.installedMembers = getInstalledMembers(root);
    }
  }

  private initStatuses(): void {
    for (const member of AGENTHOOD_MEMBERS) {
      this.statuses.set(member, this.installedMembers.has(member) ? 'watching' : 'not-installed');
    }
  }

  private registerTriggers(): void {
    for (const member of AGENTHOOD_MEMBERS) {
      const patterns = getMemberTriggers(member);
      for (const pattern of patterns) {
        this.observer.onDidSave(pattern, () => {
          if (this.statuses.get(member) !== 'not-installed') {
            this.trigger(member);
          }
        });
      }
    }

    // File create triggers The Architect
    this.observer.onDidCreate(() => {
      if (this.statuses.get('architect') !== 'not-installed') {
        this.trigger('architect');
      }
    });
  }

  trigger(memberId: string): void {
    clearTimeout(this.triggerTimers.get(memberId));
    this.statuses.set(memberId, 'triggered');
    this._onDidChangeTreeData.fire();

    const timer = setTimeout(() => {
      this.statuses.set(memberId, this.installedMembers.has(memberId) ? 'watching' : 'not-installed');
      this._onDidChangeTreeData.fire();
    }, TRIGGER_DURATION_MS);
    this.triggerTimers.set(memberId, timer);
  }

  refresh(): void {
    this.refreshInstalledMembers();
    this.initStatuses();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemberItem): vscode.TreeItem {
    return element;
  }

  getChildren(): MemberItem[] {
    return AGENTHOOD_MEMBERS.map(
      (id) => new MemberItem(id, this.statuses.get(id) ?? 'not-installed'),
    );
  }

  dispose(): void {
    this.triggerTimers.forEach((t) => clearTimeout(t));
    this._onDidChangeTreeData.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
