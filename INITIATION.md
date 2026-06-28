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

- Copy `.gitmessage` and `commitlint.config.ts` into your project root
- Install and configure Husky with `commit-msg` and `pre-push` hooks
- Install `@commitlint/cli` and `@commitlint/config-conventional`
- Copy `.github/` templates (PR template, issue templates, commit convention doc)
- Add `commitlint.yml` to `.github/workflows/`
- Copy the selected member skills into the runtime's skill directory
- Set `git config commit.template .gitmessage`
- Scaffold `.agenthood/config.json` with your selections
- Initialize LanceDB vector store (`.agenthood/memory/`)
- Initialize residual memory traces (`.agenthood/residual.json`)
- Index the Society (members, ADRs, conventions) into the knowledge graph
- Prompt for personalisation preferences (coding style, analysis depth, domain)

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

## Step 4 — Make Your First Commit

```bash
git add -p          # stage your changes interactively
git commit          # the template opens — fill it with intention
```

The Doorman will validate your message before it is recorded.
If it fails, you will be told exactly why and given a corrected suggestion.

This is not a punishment. It is a standard.

---

## Step 5 — Open Your First PR

When you push your branch and open a PR on GitHub, the PR body will be
pre-filled with the Society's template:

```
## What changed

## Why

## How to test

Closes #
```

Fill it in. The Reviewer is watching.

---

## Activating Individual Members

After initiation, you can activate or deactivate individual members:

```bash
npx agenthood activate the-scribe
npx agenthood activate the-reviewer
npx agenthood deactivate the-steward   # if you prefer manual routing
npx agenthood list                     # see which members are active
```

---

## Configuring the Society

The Society reads its configuration from `.agenthood/config.json`, scaffolded
automatically by `npx agenthood init`.

A fully annotated reference showing all supported fields is available at
[`.agenthood/config.example.json`](.agenthood/config.example.json) in the
Agenthood repository. It documents every option including `provider`,
`permissions`, and `toolScoping`.

The minimal config created by `init` looks like:

```json
{
  "version": "1",
  "runtime": "claude-code",
  "members": ["the-scribe", "the-architect", "the-reviewer", "..."],
  "hooks": { "hooksPath": ".husky" },
  "conventions": {
    "commitTemplate": ".gitmessage",
    "commitlintConfig": "commitlint.config.ts"
  }
}
```

Edit this file to add or remove members, then run `npx agenthood activate <member>`
or `npx agenthood deactivate <member>` to sync the skill files.

---

## Verifying the Initiation

Run the Doorman's health check to confirm everything is in order:

```bash
npx agenthood check
```

Expected output:
```
🏛️  Agenthood Health Check

  ✅ .gitmessage configured
  ✅ commitlint.config.ts present
  ✅ Husky commit-msg hook active
  ✅ Husky pre-push hook active
  ✅ .github/pull_request_template.md present
  ✅ .github/ISSUE_TEMPLATE/bug_report.md present
  ✅ .github/ISSUE_TEMPLATE/feature_request.md present
  ✅ .github/workflows/commitlint.yml present
  ✅ Member skills installed (N/N)
  ✅ git commit.template configured
  ✅ AGENTS.md present
  ✅ LanceDB vector store initialized
  ✅ Residual memory traces found
  ✅ Knowledge graph found
  ✅ ShortTermMemory available
  ✅ LongTermMemory available
  ✅ EpisodicMemory available
  ✅ ProjectMemory available
  ✅ RAG Indexer available
  ✅ RAG Retriever available
  ✅ Chunk strategy configured

  21 passing · 0 failing

  The Society is ready. You may proceed.
```

---

## Step 6 — Autonomous Runtime (Optional)

For teams who want members to execute autonomously — reasoning, acting, and remembering
across sessions without a human in the loop — use the TypeScript runtime.

**Requirements:** Node.js 22.14+, `GROQ_API_KEY` (free at console.groq.com) or Ollama (offline)

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

This step is entirely optional. The prompt-driven workflow from Steps 1–5 continues
to work unchanged whether or not the runtime is built.

---

## Leaving the Society

```bash
npx agenthood eject
```

This removes all hooks, templates, and config cleanly.
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
