import * as vscode from 'vscode';
import assert from 'node:assert/strict';

suite('DoormanService', () => {
  test('validates banned subjects in SCM input', async () => {
    const messages: string[] = [];
    const originalShowWarning = vscode.window.showWarningMessage;
    (vscode.window as unknown as Record<string, unknown>).showWarningMessage = (
      msg: string,
      ..._rest: unknown[]
    ) => {
      messages.push(msg);
      return undefined;
    };

    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension?.isActive) {
        await gitExtension?.activate();
      }
      const git = gitExtension?.exports?.getAPI(1);
      if (git && git.repositories.length > 0) {
        const repo = git.repositories[0];
        repo.inputBox.value = 'wip';
        await new Promise((r) => setTimeout(r, 400));
        const found = messages.some((m) => m.includes('wip'));
        assert.ok(found, 'Should warn about banned subject "wip"');
      }
    } finally {
      (vscode.window as unknown as Record<string, unknown>).showWarningMessage = originalShowWarning;
    }
  });

  test('accepts valid conventional commit format', async () => {
    const messages: string[] = [];
    const originalShowWarning = vscode.window.showWarningMessage;
    (vscode.window as unknown as Record<string, unknown>).showWarningMessage = (
      msg: string,
      ..._rest: unknown[]
    ) => {
      messages.push(msg);
      return undefined;
    };

    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension?.isActive) {
        await gitExtension?.activate();
      }
      const git = gitExtension?.exports?.getAPI(1);
      if (git && git.repositories.length > 0) {
        const repo = git.repositories[0];
        repo.inputBox.value = 'feat(api): add new endpoint';
        await new Promise((r) => setTimeout(r, 400));
        const warnings = messages.filter((m) => m.includes('type(scope)'));
        assert.equal(warnings.length, 0, 'Should not warn about valid format');
      }
    } finally {
      (vscode.window as unknown as Record<string, unknown>).showWarningMessage = originalShowWarning;
    }
  });

  test('flags non-conventional commit format', async () => {
    const messages: string[] = [];
    const originalShowWarning = vscode.window.showWarningMessage;
    (vscode.window as unknown as Record<string, unknown>).showWarningMessage = (
      msg: string,
      ..._rest: unknown[]
    ) => {
      messages.push(msg);
      return undefined;
    };

    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension?.isActive) {
        await gitExtension?.activate();
      }
      const git = gitExtension?.exports?.getAPI(1);
      if (git && git.repositories.length > 0) {
        const repo = git.repositories[0];
        repo.inputBox.value = 'random message without format';
        await new Promise((r) => setTimeout(r, 400));
        const warnings = messages.filter((m) => m.includes('type(scope)'));
        assert.ok(warnings.length > 0, 'Should warn about non-conventional format');
      }
    } finally {
      (vscode.window as unknown as Record<string, unknown>).showWarningMessage = originalShowWarning;
    }
  });
});
