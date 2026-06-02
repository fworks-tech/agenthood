# Agenthood — VS Code Extension

> *The Society, inside your editor.*

---

## Features

### 🏛️ Status Bar
Shows how many Society members are active in your project.
Click to open the member list.

```
🏛️ 9/9   ← all members active
🏛️ 3/9   ← partial activation
```

### ✅ Commit Message Validation
The Doorman validates your commit message in the SCM input as you type.
Red underline on invalid messages. Green check when it passes.

### 🎛️ Command Palette
All Society commands available via `Ctrl+Shift+P` / `Cmd+Shift+P`:

| Command | What it does |
|---------|-------------|
| `Agenthood: Initiate the Society` | Run `npx agenthood init` in a terminal |
| `Agenthood: Run Health Check` | Run `npx agenthood check` |
| `Agenthood: Read the Oath` | Open the Oath in a panel |
| `Agenthood: Activate a Member` | Pick and activate a member skill |
| `Agenthood: Deactivate a Member` | Pick and deactivate a member skill |
| `Agenthood: List Members` | Show all members and their status |

### 🔔 Ritual Notifications
When rituals are enabled, the extension surfaces:
- Morning briefing at 8:00 AM
- Health check results at 9:00 AM
- Watchman alerts when uncommitted work goes idle

---

## Installation

**From the marketplace:**
```
ext install agenthood.agenthood-vscode
```

**From source:**
```bash
cd vscode-extension
npm install
npm run package
code --install-extension agenthood-vscode-*.vsix
```

---

## Requirements

- Node.js ≥ 20
- `agenthood` package installed in your project (`npm install --save-dev agenthood`)
- Git repository

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `agenthood.enabled` | `true` | Enable the extension |
| `agenthood.statusBar.show` | `true` | Show member count in status bar |
| `agenthood.commitValidation.enabled` | `true` | Validate commits inline |
| `agenthood.rituals.notifications` | `true` | Show ritual notifications |

---

## Runtime Integration (v2.0.0 — planned)

When `agenthood-runtime` is installed and `ANTHROPIC_API_KEY` is set, a future
version of this extension will surface `agenthood-run` commands directly in the
Command Palette:

| Command | What it does |
|---------|-------------|
| `Agenthood: Invoke Member` | Pick a member and enter a task — streams output in a panel |
| `Agenthood: Review Current File` | Runs `the-reviewer` against the active editor file |
| `Agenthood: Write Commit Message` | Runs `the-scribe` against the current staged diff |
| `Agenthood: Start Ritual Scheduler` | Starts the APScheduler daemon for ritual automations |

Until then, the runtime is accessible via the integrated terminal with `agenthood-run`.

## The Society

This extension is part of [Agenthood](https://github.com/fworks-tech/agenthood) —
a society of AI agents with impeccable standards and zero tolerance for `fix stuff` commits.
