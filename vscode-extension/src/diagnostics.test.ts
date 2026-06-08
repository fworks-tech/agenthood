import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  getAgentDiagnostics,
  setDiagnostic,
  clearDiagnostics,
  clearAllDiagnostics,
  disposeDiagnostics,
} from './diagnostics.js';

suite('AgentDiagnostics', () => {
  const testUri = vscode.Uri.parse('file:///test/example.ts');
  const testUri2 = vscode.Uri.parse('file:///test/other.ts');

  teardown(() => {
    clearAllDiagnostics();
    disposeDiagnostics();
  });

  test('getAgentDiagnostics returns the same collection on repeated calls', () => {
    const a = getAgentDiagnostics();
    const b = getAgentDiagnostics();
    assert.strictEqual(a, b);
  });

  test('setDiagnostic adds a diagnostic to the collection', () => {
    const range = new vscode.Range(0, 0, 0, 10);
    setDiagnostic(testUri, range, 'test message', vscode.DiagnosticSeverity.Error, 'The Auditor');

    const diagnostics = getAgentDiagnostics().get(testUri);
    assert.strictEqual(diagnostics?.length, 1);
    assert.strictEqual(diagnostics?.[0].message, 'test message');
    assert.strictEqual(diagnostics?.[0].severity, vscode.DiagnosticSeverity.Error);
    assert.strictEqual(diagnostics?.[0].source, 'The Auditor');
  });

  test('setDiagnostic accumulates multiple diagnostics for same uri', () => {
    const range = new vscode.Range(0, 0, 0, 10);
    setDiagnostic(testUri, range, 'first', vscode.DiagnosticSeverity.Error, 'The Auditor');
    setDiagnostic(testUri, range, 'second', vscode.DiagnosticSeverity.Warning, 'The Reviewer');

    const diagnostics = getAgentDiagnostics().get(testUri);
    assert.strictEqual(diagnostics?.length, 2);
  });

  test('clearDiagnostics removes all diagnostics for the given uri only', () => {
    const range = new vscode.Range(0, 0, 0, 10);
    setDiagnostic(testUri, range, 'keep me', vscode.DiagnosticSeverity.Error, 'The Auditor');
    setDiagnostic(testUri2, range, 'keep me too', vscode.DiagnosticSeverity.Error, 'The Auditor');

    clearDiagnostics(testUri);

    assert.strictEqual(getAgentDiagnostics().get(testUri)?.length ?? 0, 0);
    assert.strictEqual(getAgentDiagnostics().get(testUri2)?.length, 1);
  });

  test('clearAllDiagnostics removes all diagnostics across all uris', () => {
    const range = new vscode.Range(0, 0, 0, 10);
    setDiagnostic(testUri, range, 'a', vscode.DiagnosticSeverity.Error, 'test');
    setDiagnostic(testUri2, range, 'b', vscode.DiagnosticSeverity.Warning, 'test');

    clearAllDiagnostics();

    assert.strictEqual(getAgentDiagnostics().get(testUri)?.length ?? 0, 0);
    assert.strictEqual(getAgentDiagnostics().get(testUri2)?.length ?? 0, 0);
  });

  test('severity mapping: Error, Warning, Information, Hint all accepted', () => {
    const range = new vscode.Range(0, 0, 0, 1);
    setDiagnostic(testUri, range, 'e', vscode.DiagnosticSeverity.Error, 'test');
    setDiagnostic(testUri, range, 'w', vscode.DiagnosticSeverity.Warning, 'test');
    setDiagnostic(testUri, range, 'i', vscode.DiagnosticSeverity.Information, 'test');
    setDiagnostic(testUri, range, 'h', vscode.DiagnosticSeverity.Hint, 'test');

    const diagnostics = getAgentDiagnostics().get(testUri);
    const severities = diagnostics?.map((d) => d.severity) ?? [];
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Error));
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Warning));
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Information));
    assert.ok(severities.includes(vscode.DiagnosticSeverity.Hint));
  });
});
