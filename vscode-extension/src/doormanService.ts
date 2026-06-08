import * as vscode from 'vscode';

const BANNED_SUBJECTS = ['wip', 'fix stuff', 'update', 'changes', 'misc', 'asdf', 'temp', 'stuff', 'test'];
const BRANCH_PATTERN = /^(feat|fix|docs|test|refactor|ci|chore)\/issue-\d+-[a-z0-9-]+$/;
const DEBOUNCE_MS = 300;

export class DoormanService {
  private disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private lastCheckedBranch: string | undefined;

  activate(): void {
    const config = vscode.workspace.getConfiguration('agenthood');
    if (!config.get<boolean>('commitValidation.enabled', true)) {
      return;
    }

    // Watch SCM input box via git extension
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension?.isActive) {
      gitExtension?.activate().then(() => this.hookGitApi());
      return;
    }
    this.hookGitApi();
  }

  private hookGitApi(): void {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    const git = gitExtension?.exports?.getAPI(1);
    if (!git) {
      return;
    }

    for (const repo of git.repositories) {
      this.watchRepository(repo);
    }

    this.disposables.push(
      git.onDidOpenRepository((repo: unknown) => this.watchRepository(repo)),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private watchRepository(repo: any): void {
    this.disposables.push(
      repo.inputBox.onDidChange((value: string) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.validateSubject(value), DEBOUNCE_MS);
      }),
      repo.state.onDidChange(() => {
        const branch: string | undefined = repo.state.HEAD?.name;
        if (branch && branch !== this.lastCheckedBranch) {
          this.lastCheckedBranch = branch;
          this.validateBranch(branch);
        }
      }),
    );
  }

  private validateSubject(message: string): void {
    const subject = message.split('\n')[0].trim().toLowerCase();
    if (!subject) {
      return;
    }

    const banned = BANNED_SUBJECTS.find((b) => subject === b || subject.startsWith(b + ' '));
    if (banned) {
      vscode.window.showWarningMessage(
        `The Doorman rejects "${subject}". Write a commit message worth reading.`,
        'Dismiss',
      );
      return;
    }

    // Check conventional commit format: type(scope): subject
    const conventionalPattern = /^(feat|fix|docs|test|refactor|ci|chore)(\([^)]+\))?:\s.+/;
    if (!conventionalPattern.test(message.split('\n')[0])) {
      vscode.window.showWarningMessage(
        `The Doorman: expected "type(scope): subject". Got: "${message.split('\n')[0].substring(0, 40)}"`,
        'Dismiss',
      );
    }
  }

  private validateBranch(branch: string): void {
    const knownBases = ['main', 'master', 'develop', 'HEAD'];
    if (knownBases.includes(branch)) {
      return;
    }
    if (!BRANCH_PATTERN.test(branch)) {
      vscode.window.showWarningMessage(
        `The Doorman: branch "${branch}" doesn't follow type/issue-NUMBER-description.`,
        'Dismiss',
      );
    }
  }

  dispose(): void {
    clearTimeout(this.debounceTimer);
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
