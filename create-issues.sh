#!/bin/bash

echo "Creating Issue 1: The Observer Core..."
gh issue create \
  --title "feat(vscode): implement workspace event bus for passive member observation" \
  --label "enhancement" \
  --body "Before members can react, we need a centralized way to broadcast VSCode events to the Society without cluttering \`extension.ts\`.

### Tasks
- [ ] Create an \`ObserverService\` that listens to \`vscode.workspace.onDidSaveTextDocument\`, \`vscode.workspace.onDidCreateFiles\`, and \`vscode.window.onDidChangeActiveTextEditor\`.
- [ ] Create a Pub/Sub mechanism where individual member classes (e.g., \`AuditorObserver\`) can subscribe to relevant file patterns.
- [ ] Add a dedicated Output Channel named **Agenthood: Society Observations** where members can log their thoughts passively."

echo "Creating Issue 2: Real-time Doorman..."
gh issue create \
  --title "feat(vscode): The Doorman - real-time commit validation in SCM view" \
  --label "enhancement" \
  --body "Currently, The Doorman yells at you *after* you try to commit via Husky hooks. The Doorman should watch you type in the VSCode Source Control input box and provide immediate feedback.

### Tasks
- [ ] Integrate with the built-in \`vscode.git\` API.
- [ ] Listen to \`repository.inputBox.value\` changes (debounced).
- [ ] Use \`vscode.window.showWarningMessage\` if the message starts with a vague subject (e.g., \`fix stuff\`) before the commit happens.
- [ ] Warn if a branch is stale or violates naming conventions on checkout."

echo "Creating Issue 3: The Auditor on Overwatch..."
gh issue create \
  --title "feat(vscode): The Auditor - on-save dependency and secret scanning" \
  --label "enhancement" \
  --body "The Auditor shouldn't wait for CI or a pre-commit hook to find a leaked API key or a bad dependency.

### Tasks
- [ ] Subscribe to file save events via \`ObserverService\`.
- [ ] If a \`.ts\`, \`.js\`, or \`.env\` file is saved, run a fast regex pass for secrets.
- [ ] If a secret is found, highlight the line using VSCode Diagnostics (red squiggly) with the source **The Auditor**.
- [ ] If \`package.json\` is saved, run a background check for wildcard versions (\`^latest\`, \`*\`) and surface a diagnostic warning to pin the exact version."

echo "Creating Issue 4: The Reviewer's Diagnostics..."
gh issue create \
  --title "feat(vscode): The Reviewer - surface [suggestion] and [blocking] via Diagnostics API" \
  --label "enhancement" \
  --body "Integrate The Reviewer directly into the editor's native problem window.

### Tasks
- [ ] Create a \`vscode.DiagnosticCollection\` named **Agenthood**.
- [ ] When the user finishes a significant block of work (or via a new manual command: \`Agenthood: Ask The Reviewer\`), run the file through The Reviewer.
- [ ] Parse The Reviewer's output and map \`[blocking]\` to \`DiagnosticSeverity.Error\`, and \`[suggestion]\` / \`[nit]\` to \`DiagnosticSeverity.Information\`."

echo "Creating Issue 5: The Librarian's Nudge..."
gh issue create \
  --title "feat(vscode): The Librarian - stale documentation nudge" \
  --label "enhancement" \
  --body "The Librarian knows that undocumented code is tech debt.

### Tasks
- [ ] Keep a rolling memory of touched files in the current session.
- [ ] If a user heavily modifies a core file but hasn't opened any \`.md\` files in the workspace, have The Librarian show a non-intrusive notification: *\"You've modified the API heavily. The Librarian suggests updating the README.\"*"

echo "Done! All 5 issues have been created in your repository."
