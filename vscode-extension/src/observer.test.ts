import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const EXT_ID = 'fworks-tech.agenthood-vscode';

async function waitFor(predicate: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 100));
  }
}

suite('ObserverService Integration Tests', () => {
  let api: { observerService: import('./observer').ObserverService };

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert.ok(ext, 'Extension should be registered');
    api = await ext.activate();
  });

  test('activates and exposes ObserverService', () => {
    assert.ok(api.observerService, 'ObserverService should be initialized');
  });

  test('registers all 6 commands', async () => {
    const cmds = await vscode.commands.getCommands(true);
    const expected = [
      'agenthood.init', 'agenthood.check', 'agenthood.oath',
      'agenthood.activate', 'agenthood.deactivate', 'agenthood.list',
    ];
    for (const cmd of expected) {
      assert.ok(cmds.includes(cmd), `Missing command: ${cmd}`);
    }
  });

  test('fires onDidSave callback for matching file', async () => {
    const wsPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const testFile = path.join(wsPath, 'dist', '__test_save_match__.md');

    // Clean up any leftover file
    await fs.unlink(testFile).catch(() => {});

    let fired = false;
    let triggerCount = 0;

    // Register callback first
    api.observerService.onDidSave(/__test_save_match__\.md$/, () => {
      triggerCount++;
      fired = true;
    });

    try {
      // Create test file
      await fs.writeFile(testFile, 'initial content');

      // Open and show document
      const uri = vscode.Uri.file(testFile);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      // Modify the document
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), 'test\n');
      });

      // Save it
      const saved = await doc.save();
      assert.ok(saved, 'Document should save successfully');

      // Wait for callback
      await waitFor(() => fired, 5000);
      assert.ok(fired, `onDidSave callback should have fired (triggered ${triggerCount} times)`);
    } finally {
      await fs.unlink(testFile).catch(() => {});
    }
  });

  test('does NOT fire onDidSave for non-matching file', async () => {
    const wsPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const testFile = path.join(wsPath, 'dist', '__test_save_nomatch__.txt');

    // Clean up any leftover file
    await fs.unlink(testFile).catch(() => {});

    let fired = false;

    // Register callback that should never fire for .txt files
    api.observerService.onDidSave(/members\/.*\.md$/, () => {
      fired = true;
    });

    try {
      // Create test file with non-matching extension
      await fs.writeFile(testFile, 'initial content');

      // Open and show document
      const uri = vscode.Uri.file(testFile);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      // Modify the document
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(0, 0), 'test\n');
      });

      // Save it
      await doc.save();

      // Wait to ensure no callback fires
      await new Promise(r => setTimeout(r, 500));
      assert.equal(fired, false, 'onDidSave should not fire for non-matching file');
    } finally {
      await fs.unlink(testFile).catch(() => {});
    }
  });

  test('registers onDidCreate subscription without error', () => {
    api.observerService.onDidCreate(() => {
      // callback that should be registered
    });

    // Just verify subscription doesn't throw
    assert.ok(true, 'onDidCreate registration should not throw');
  });
});
