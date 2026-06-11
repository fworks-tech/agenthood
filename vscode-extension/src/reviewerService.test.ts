import * as assert from 'assert';
import * as vscode from 'vscode';
import { ReviewerService } from './reviewerService.js';
import {
  getAgentDiagnostics,
  clearAllDiagnostics,
  disposeDiagnostics,
} from './diagnostics.js';

suite('ReviewerService', () => {
  let reviewerService: ReviewerService;

  setup(() => {
    reviewerService = new ReviewerService();
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
    reviewerService.activate(context);
  });

  teardown(() => {
    reviewerService.dispose();
    clearAllDiagnostics();
    disposeDiagnostics();
  });

  test('detects [blocking] annotation', async () => {
    const content = '// [blocking] this is an error\nconst x = 5;';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length > 0, 'Should detect [blocking] annotation');
    const blocking = diagnostics.find(d => d.message.includes('[blocking]'));
    assert.ok(blocking, 'Should have [blocking] diagnostic');
    assert.strictEqual(blocking.severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(blocking.source, 'The Reviewer');
  });

  test('detects [suggestion] annotation', async () => {
    const content = '// [suggestion] consider refactoring\nconst y = 10;';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length > 0, 'Should detect [suggestion]');
    const suggestion = diagnostics.find(d => d.message.includes('[suggestion]'));
    assert.ok(suggestion, 'Should have [suggestion] diagnostic');
    assert.strictEqual(suggestion.severity, vscode.DiagnosticSeverity.Information);
  });

  test('detects [nit] annotation', async () => {
    const content = '// [nit] minor style issue\nfunction foo() {}';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length > 0, 'Should detect [nit]');
    const nit = diagnostics.find(d => d.message.includes('[nit]'));
    assert.ok(nit, 'Should have [nit] diagnostic');
    assert.strictEqual(nit.severity, vscode.DiagnosticSeverity.Hint);
  });

  test('handles multiple mixed annotations', async () => {
    const content = `// [blocking] critical bug
// [suggestion] nice to have
// [nit] formatting
const x = 5;`;
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length >= 3, 'Should detect all annotations');
    const severities = diagnostics.map(d => d.severity);
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Error));
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Information));
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Hint));
  });

  test('ignores files without annotations', async () => {
    const content = 'const x = 5;\nfunction foo() { return x; }';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri) ?? [];
    assert.strictEqual(diagnostics.length, 0, 'Should have no diagnostics for clean file');
  });

  test('handles case-insensitive annotations', async () => {
    const content = '// [BLOCKING] uppercase blocking\nconst x = 5;';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length > 0);
    assert.strictEqual(diagnostics![0].severity, vscode.DiagnosticSeverity.Error);
  });

  test('preserves message text after tag', async () => {
    const content = '// [suggestion] this is the suggestion message';
    const uri = vscode.Uri.parse('file:///test/review.ts');
    const doc = {
      uri,
      getText: () => content,
      fileName: 'review.ts',
    } as unknown as vscode.TextDocument;

    reviewerService['reviewDocument'](doc);

    const diagnostics = getAgentDiagnostics().get(uri);
    assert.ok(diagnostics && diagnostics.length > 0);
    assert.ok(
      diagnostics![0].message.includes('this is the suggestion message'),
      'Message should preserve text after tag',
    );
  });
});
