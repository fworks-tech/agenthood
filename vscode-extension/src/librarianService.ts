import * as vscode from 'vscode';
import { ObserverService } from './observer.js';

const NON_MD_THRESHOLD = 10;

export class LibrarianService {
  private nonMdSaveCount = 0;
  private mdOpenedThisSession = false;
  private nudgeSentThisSession = false;

  constructor(private readonly observer: ObserverService) {}

  activate(): void {
    // Track non-md source file saves
    this.observer.onDidSave(/\.(ts|js|jsx|tsx|py|go|java|cs|rb|rs|cpp|c|h)$/, () => {
      this.nonMdSaveCount++;
      this.maybeNudge();
    });

    // Track md opens — resets the nudge trigger
    this.observer.onDidSave(/\.md$/, () => {
      this.mdOpenedThisSession = true;
    });

    // Also count explicit md file opens (not just saves)
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.fileName.endsWith('.md')) {
        this.mdOpenedThisSession = true;
      }
    });
  }

  private maybeNudge(): void {
    if (this.nudgeSentThisSession) {
      return;
    }
    if (this.nonMdSaveCount >= NON_MD_THRESHOLD && !this.mdOpenedThisSession) {
      this.nudgeSentThisSession = true;
      vscode.window.showInformationMessage(
        `The Librarian: you've modified ${this.nonMdSaveCount} source files this session. Have you considered updating the documentation?`,
        'Open README',
        'Dismiss',
      ).then((choice) => {
        if (choice === 'Open README') {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
          if (workspaceRoot) {
            const readmeUri = vscode.Uri.joinPath(workspaceRoot, 'README.md');
            vscode.window.showTextDocument(readmeUri).then(undefined, () => {
              vscode.window.showInformationMessage('No README.md found in workspace root.');
            });
          }
        }
      });
    }
  }

  resetSession(): void {
    this.nonMdSaveCount = 0;
    this.mdOpenedThisSession = false;
    this.nudgeSentThisSession = false;
  }
}
