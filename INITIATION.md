# The Initiation

> *Before the Society can help your project, your project must join the Society.*

Welcome. You are here because you have decided that `fix stuff` is not a commit message.
That a blank PR description is not a PR description. That shipping without tests is not shipping.

The Initiation takes about five minutes. The standards last forever.

---

## Step 1 — Install the Society

```bash
# npm (recommended)
npm install --save-dev agenthood

# or clone directly
git clone https://github.com/fworks-tech/agenthood.git
```

---

## Step 2 — Run the Initiation

```bash
npx agenthood init
```

This single command will prompt you for two choices:

1. **Which AI runtime are you using?** — Claude Code, Copilot, or other.
   Skills are installed into the matching directory (`.claude/skills/`, `.github/skills/`, or `.agenthood/skills/`).

2. **Which members do you want to activate?** — enter numbers separated by commas, or `all`.

Then it will:

- Copy the selected member skills into the runtime's skill directory
- Copy `AGENTS.md` into your project root
- Scaffold `.agenthood/config.json` with your selections

Running `init` a second time is safe — existing files are never overwritten.

---

## Step 3 — Read the Oath

```bash
cat node_modules/agenthood/oath.md
# or
npx agenthood oath
```

Read it. Mean it.

---

## Step 4 — Verifying the Initiation

Run the Doorman's health check to confirm everything is in order:

```bash
npx agenthood check
```

Expected output:
```
🏛️  Agenthood Health Check

  ✅ Member skills installed (X/X)
  ✅ AGENTS.md present
  ✅ Agenthood config found
  
  X passing · 0 failing

  The Society is ready. You may proceed.
```

---

## Step 5 — Autonomous Runtime (Optional)

For teams who want members to execute autonomously — reasoning, acting, and remembering
across sessions without a human in the loop — use the TypeScript runtime.

**Requirements:** Node.js 22.14+, `OPENCODE_API_KEY` (or a key for another provider — the default follows the `providers` list in `.agenthood/config.json`), or Ollama for offline execution

```bash
# Build the runtime (once, after install)
npm run build

# List all members
npx agenthood list

# Invoke a member against a real task
npx agenthood run the-scribe "write a commit message for the current diff"
npx agenthood run the-architect "plan the implementation for issue #42"
npx agenthood run the-reviewer "review the open PR"
```

The runtime reads the same `.agenthood/config.json` the CLI created — no
additional configuration required.

Every run records a decision and provenance entry in `.agenthood/decisions/`
and `.agenthood/provenance/` — a tamper-evident audit trail of what each member
did and why, so the runtime is not a black box
([ADR-015](docs/adr/ADR-015-decision-intelligence-and-provenance.md)).

This step is entirely optional. The prompt-driven workflow from Steps 1–4 continues
to work unchanged whether or not the runtime is built.

---

## Leaving the Society

```bash
npx agenthood eject
```

This removes all config and skill files cleanly.
The Society will not hold it against you.
It will simply note that your commits were better while you were a member.

---

## What the Society Will Never Do

- Modify your source code without your approval
- Push to any remote without your explicit instruction
- Run destructive commands without confirmation
- Silently ignore a failing check
- Pretend a bad commit message is acceptable

---

*The Society is open to all who take the oath seriously.*
*Membership is free. Standards are not.*
