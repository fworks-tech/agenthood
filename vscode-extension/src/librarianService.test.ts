import * as assert from 'assert';
import * as vscode from 'vscode';
import { LibrarianService } from './librarianService.js';
import { ObserverService } from './observer.js';

suite('LibrarianService', () => {
  let librarianService: LibrarianService;
  let observerService: ObserverService;

  setup(() => {
    observerService = new ObserverService({} as unknown as vscode.ExtensionContext);
    librarianService = new LibrarianService(observerService);
    librarianService.activate();
  });

  teardown(() => {
    librarianService.resetSession();
  });

  test('tracks non-markdown source file saves', async () => {
    const uri = vscode.Uri.parse('file:///test/code.ts');
    const doc = {
      uri,
      getText: () => 'const x = 5;',
      fileName: 'code.ts',
    } as unknown as vscode.TextDocument;

    for (let i = 0; i < 3; i++) {
      observerService['handleSave'](doc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(
      librarianService.getNonMdSaveCount(),
      3,
      'Should count 3 source file saves',
    );
  });

  test('does not nudge below threshold', async () => {
    const uri = vscode.Uri.parse('file:///test/code.ts');
    const doc = {
      uri,
      getText: () => 'const x = 5;',
      fileName: 'code.ts',
    } as unknown as vscode.TextDocument;

    for (let i = 0; i < 9; i++) {
      observerService['handleSave'](doc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(
      librarianService.getNudgeSentThisSession(),
      false,
      'Should not nudge at 9 saves (below threshold)',
    );
  });

  test('nudges at threshold without markdown interaction', async () => {
    const uri = vscode.Uri.parse('file:///test/code.ts');
    const doc = {
      uri,
      getText: () => 'const x = 5;',
      fileName: 'code.ts',
    } as unknown as vscode.TextDocument;

    for (let i = 0; i < 10; i++) {
      observerService['handleSave'](doc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(
      librarianService.getNudgeSentThisSession(),
      true,
      'Should nudge after 10 saves without markdown',
    );
  });

  test('suppresses nudge when markdown file is opened', async () => {
    const mdUri = vscode.Uri.parse('file:///test/README.md');
    const mdDoc = {
      uri: mdUri,
      getText: () => '# Test',
      fileName: 'README.md',
    } as unknown as vscode.TextDocument;

    observerService['handleSave'](mdDoc);
    await new Promise(r => setTimeout(r, 50));

    const codeUri = vscode.Uri.parse('file:///test/code.ts');
    const codeDoc = {
      uri: codeUri,
      getText: () => 'const x = 5;',
      fileName: 'code.ts',
    } as unknown as vscode.TextDocument;

    for (let i = 0; i < 10; i++) {
      observerService['handleSave'](codeDoc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(
      librarianService.getNudgeSentThisSession(),
      false,
      'Should not nudge if markdown was opened this session',
    );
  });

  test('resetSession clears state', async () => {
    const uri = vscode.Uri.parse('file:///test/code.ts');
    const doc = {
      uri,
      getText: () => 'const x = 5;',
      fileName: 'code.ts',
    } as unknown as vscode.TextDocument;

    for (let i = 0; i < 10; i++) {
      observerService['handleSave'](doc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(librarianService.getNudgeSentThisSession(), true, 'Should have nudged');

    librarianService.resetSession();

    assert.strictEqual(
      librarianService.getNonMdSaveCount(),
      0,
      'Should reset save count after resetSession',
    );
    assert.strictEqual(
      librarianService.getNudgeSentThisSession(),
      false,
      'Should reset nudge flag after resetSession',
    );

    for (let i = 0; i < 10; i++) {
      observerService['handleSave'](doc);
      await new Promise(r => setTimeout(r, 50));
    }

    assert.strictEqual(
      librarianService.getNudgeSentThisSession(),
      true,
      'Should nudge again after reset',
    );
  });

  test('counts only matching file extensions', async () => {
    const tsUri = vscode.Uri.parse('file:///test/code.ts');
    const jsUri = vscode.Uri.parse('file:///test/code.js');
    const txtUri = vscode.Uri.parse('file:///test/note.txt');

    const tsDoc = { uri: tsUri, getText: () => '', fileName: 'code.ts' } as unknown as vscode.TextDocument;
    const jsDoc = { uri: jsUri, getText: () => '', fileName: 'code.js' } as unknown as vscode.TextDocument;
    const txtDoc = { uri: txtUri, getText: () => '', fileName: 'note.txt' } as unknown as vscode.TextDocument;

    observerService['handleSave'](tsDoc);
    observerService['handleSave'](jsDoc);
    observerService['handleSave'](txtDoc);
    await new Promise(r => setTimeout(r, 100));

    assert.strictEqual(
      librarianService.getNonMdSaveCount(),
      2,
      'Should count only .ts and .js files, not .txt',
    );
  });
});
