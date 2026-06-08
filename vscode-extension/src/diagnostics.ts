import * as vscode from 'vscode';

let collection: vscode.DiagnosticCollection | undefined;

export function getAgentDiagnostics(): vscode.DiagnosticCollection {
  if (!collection) {
    collection = vscode.languages.createDiagnosticCollection('agenthood');
  }
  return collection;
}

export function setDiagnostic(
  uri: vscode.Uri,
  range: vscode.Range,
  message: string,
  severity: vscode.DiagnosticSeverity,
  source: string,
): void {
  const diagnostics = getAgentDiagnostics();
  const existing = diagnostics.get(uri) ?? [];
  const next: vscode.Diagnostic = {
    range,
    message,
    severity,
    source,
  };
  diagnostics.set(uri, [...existing, next]);
}

export function clearDiagnostics(uri: vscode.Uri): void {
  getAgentDiagnostics().delete(uri);
}

export function clearAllDiagnostics(): void {
  getAgentDiagnostics().clear();
}

export function disposeDiagnostics(): void {
  collection?.dispose();
  collection = undefined;
}
