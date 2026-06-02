import * as vscode from 'vscode';

export type SaveCallback = (document: vscode.TextDocument) => void;
export type CreateCallback = (event: vscode.FileCreateEvent) => void;
export type EditorChangeCallback = (editor: vscode.TextEditor | undefined) => void;

export class ObserverService {
  private saveSubscriptions: { pattern: RegExp; callback: SaveCallback }[] = [];
  private createSubscriptions: CreateCallback[] = [];
  private editorChangeSubscriptions: EditorChangeCallback[] = [];
  private outputChannel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext) {
    // Create the dedicated passive observation channel
    this.outputChannel = vscode.window.createOutputChannel('Agenthood: Society Observations');
    context.subscriptions.push(this.outputChannel);

    // Bind VS Code workspace events to our event bus
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => this.handleSave(doc)),
      vscode.workspace.onDidCreateFiles((e) => this.handleCreate(e)),
      vscode.window.onDidChangeActiveTextEditor((e) => this.handleEditorChange(e))
    );

    this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [The Observer Core] Society event bus initialized.`);
  }

  /**
   * Allows members to log their passive thoughts without interrupting the user.
   */
  public logObservation(member: string, message: string): void {
    this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] [${member}] ${message}`);
  }

  /**
   * Subscribe to file save events that match a specific regex pattern.
   */
  public onDidSave(pattern: RegExp, callback: SaveCallback): void {
    this.saveSubscriptions.push({ pattern, callback });
  }

  /**
   * Subscribe to file creation events.
   */
  public onDidCreate(callback: CreateCallback): void {
    this.createSubscriptions.push(callback);
  }

  /**
   * Subscribe to active text editor changes (when the user switches tabs).
   */
  public onDidChangeActiveEditor(callback: EditorChangeCallback): void {
    this.editorChangeSubscriptions.push(callback);
  }

  private handleSave(document: vscode.TextDocument): void {
    const fsPath = document.uri.fsPath;
    // Normalize slashes for easier regex matching cross-platform
    const normalizedPath = fsPath.replace(/\\/g, '/');
    
    for (const sub of this.saveSubscriptions) {
      if (sub.pattern.test(normalizedPath) || sub.pattern.test(fsPath)) {
        sub.callback(document);
      }
    }
  }

  private handleCreate(event: vscode.FileCreateEvent): void {
    for (const sub of this.createSubscriptions) {
      sub.callback(event);
    }
  }

  private handleEditorChange(editor: vscode.TextEditor | undefined): void {
    for (const sub of this.editorChangeSubscriptions) {
      sub.callback(editor);
    }
  }
}