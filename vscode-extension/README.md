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

### 🎛️ Command Palette
All Society commands available via `Ctrl+Shift+P` / `Cmd+Shift+P`:

| Command | What it does |
|---------|-------------|
| `Agenthood: Initiate the Society` | Run `npx agenthood init` in a terminal |
| `Agenthood: Run Health Check` | Run `npx agenthood check` |
| `Agenthood: Read the Oath` | Open the Oath in a beautiful panel |
| `Agenthood: Activate a Member` | Pick and activate a member skill |
| `Agenthood: Deactivate a Member` | Pick and deactivate a member skill |
| `Agenthood: List Members` | Show all members and their status |

### 🏛️ The Oath
Read the Society's oath and be reminded of the standards. Available via command palette or by clicking the status bar.

### ✅ Commit Message Validation
Validation is handled by the **Doorman** through Husky hooks at commit time.
The extension displays errors in the terminal output when commits fail validation.

---

## Installation

**From the marketplace:**
```
ext install fworks-tech.agenthood-vscode
```

**From source:**
```bash
cd vscode-extension
npm install
npm run build
npm run package
code --install-extension agenthood-vscode-*.vsix
```

---

## Requirements

- Node.js ≥ 20
- `agenthood` package installed in your project (`npm install --save-dev agenthood`)
- Git repository initialized in your workspace

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `agenthood.enabled` | `true` | Enable the extension |
| `agenthood.statusBar.show` | `true` | Show member count in status bar |
| `agenthood.commitValidation.enabled` | `true` | Log validation attempts |
| `agenthood.rituals.notifications` | `true` | Reserved for future ritual notifications |

---

## Building from Source

### Development

```bash
cd vscode-extension
npm install
npm run watch    # TypeScript in watch mode
```

### Testing

```bash
npm run build
npm test
```

### Packaging

```bash
npm run package  # Creates .vsix file
```

---

## Troubleshooting

### Extension doesn't activate
- Ensure you have `.gitmessage` or `commitlint.config.ts` in your workspace
- Verify Agenthood is initialized: `npx agenthood init`

### Status bar shows 0/9 members
- Check that member skill files exist in `.agenthood/skills/` or `.claude/skills/`
- Run `npx agenthood list` to verify setup

### Terminal commands fail silently
- Check the **Agenthood** output channel (bottom panel) for error messages
- Verify `npx agenthood` is accessible: `npx agenthood --help`

---

## Runtime Integration (v2.0.0 — planned)

When the TypeScript runtime is installed and `ANTHROPIC_API_KEY` is set, a future
version of this extension will surface `agenthood` commands directly in the
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

Read the [charter](../README.md) to understand what we stand for.

