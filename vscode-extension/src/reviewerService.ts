import * as vscode from 'vscode';
import { clearDiagnostics, setDiagnostic } from './diagnostics.js';

// Matches: // [blocking] message  or  // [suggestion] message  or  // [nit] message
const ANNOTATION_PATTERN = /\/\/\s*\[(blocking|suggestion|nit)\]\s+(.+)/gi;

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  blocking: vscode.DiagnosticSeverity.Error,
  suggestion: vscode.DiagnosticSeverity.Information,
  nit: vscode.DiagnosticSeverity.Hint,
};

export class ReviewerService {
  private disposables: vscode.Disposable[] = [];

  activate(context: vscode.ExtensionContext): void {
    this.disposables.push(
      vscode.commands.registerCommand('agenthood.askReviewer', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showInformationMessage('The Reviewer: open a file to review first.');
          return;
        }
        this.reviewDocument(editor.document);
        vscode.window.showInformationMessage(
          `The Reviewer has finished. Check the Problems panel.`,
        );
      }),
    );
    context.subscriptions.push(...this.disposables);
  }

  private reviewDocument(doc: vscode.TextDocument): void {
    clearDiagnostics(doc.uri);
    const text = doc.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      const re = new RegExp(ANNOTATION_PATTERN.source, 'gi');
      while ((match = re.exec(line)) !== null) {
        const tag = match[1].toLowerCase();
        const message = match[2].trim();
        const severity = SEVERITY_MAP[tag] ?? vscode.DiagnosticSeverity.Information;
        const range = new vscode.Range(i, 0, i, line.length);
        setDiagnostic(doc.uri, range, `The Reviewer [${tag}]: ${message}`, severity, 'The Reviewer');
      }
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
