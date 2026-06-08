import * as vscode from 'vscode';
import { ObserverService } from './observer.js';
import { clearDiagnostics, setDiagnostic } from './diagnostics.js';

// Patterns that indicate a likely hardcoded secret
const SECRET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'Hardcoded API key or token',
    pattern: /(?:api[_-]?key|api[_-]?token|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9+/\-_]{16,}['"]?/i,
  },
  {
    label: 'Hardcoded password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
  {
    label: 'Potential private key header',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];

const WILDCARD_DEP_PATTERN = /"[^"]+"\s*:\s*"(\*|latest|\^latest|~latest)"/g;

export class AuditorService {
  constructor(private readonly observer: ObserverService) {}

  activate(): void {
    this.observer.onDidSave(/\.(ts|js|jsx|tsx|env|env\..+)$/, (doc) => {
      this.scanForSecrets(doc);
    });

    this.observer.onDidSave(/package\.json$/, (doc) => {
      this.scanForWildcardDeps(doc);
    });
  }

  private scanForSecrets(doc: vscode.TextDocument): void {
    clearDiagnostics(doc.uri);
    const text = doc.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { label, pattern } of SECRET_PATTERNS) {
        if (pattern.test(line)) {
          const range = new vscode.Range(i, 0, i, line.length);
          setDiagnostic(
            doc.uri,
            range,
            `The Auditor: ${label} detected. Do not commit secrets.`,
            vscode.DiagnosticSeverity.Error,
            'The Auditor',
          );
        }
      }
    }
  }

  private scanForWildcardDeps(doc: vscode.TextDocument): void {
    clearDiagnostics(doc.uri);
    const text = doc.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      const re = new RegExp(WILDCARD_DEP_PATTERN.source, 'g');
      while ((match = re.exec(line)) !== null) {
        const range = new vscode.Range(i, match.index, i, match.index + match[0].length);
        setDiagnostic(
          doc.uri,
          range,
          `The Auditor: wildcard version "${match[1]}" is unpinned. Pin to an exact version.`,
          vscode.DiagnosticSeverity.Warning,
          'The Auditor',
        );
      }
    }
  }
}
