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

This single command will:

- Copy `.gitmessage` and `commitlint.config.cjs` into your project root
- Install and configure Husky with `commit-msg` and `pre-push` hooks
- Install `@commitlint/cli` and `@commitlint/config-conventional`
- Copy `.github/` templates (PR template, issue templates, commit convention doc)
- Add `commitlint.yml` and `pr-title.yml` to `.github/workflows/`
- Copy the member skills into `.claude/skills/` (or `.codebuddy/skills/` if detected)
- Activate `git config commit.template .gitmessage`

At the end, it will ask:
> *"Which members do you want to activate? [all / select]"*

You may activate all nine or choose specific members.

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
npx agenthood deactivate the-watchman   # if you prefer quiet
npx agenthood list                      # see which members are active
```

---

## Configuring the Society

The Society reads its configuration from `.agenthood/config.json`:

```json
{
  "members": {
    "active": ["all"],
    "disabled": []
  },
  "rituals": {
    "morning-briefing": { "enabled": true, "time": "08:00" },
    "the-inspection": { "enabled": true, "time": "09:00" },
    "the-watchman": { "enabled": true, "interval": "2h" },
    "evening-report": { "enabled": true, "time": "18:00" }
  },
  "portals": {
    "github": { "enabled": true },
    "slack": { "enabled": false },
    "sentry": { "enabled": false }
  },
  "thresholds": {
    "idleCommitMinutes": 120,
    "maxFileLines": 500,
    "branchDriftCommits": 20,
    "staleBranchDays": 7
  }
}
```

---

## VS Code Extension

Install the **Agenthood** VS Code extension for:
- Status bar showing active members and queue state
- Inline commit message validation as you type
- One-click member activation
- Ritual notifications in the editor

```
ext install agenthood.agenthood-vscode
```

Or search **"Agenthood"** in the VS Code Extensions panel.

---

## Verifying the Initiation

Run the Doorman's health check to confirm everything is in order:

```bash
npx agenthood check
```

Expected output:
```
🏛️ Agenthood Initiation Check

✅ .gitmessage configured
✅ commitlint.config.cjs present
✅ Husky commit-msg hook active
✅ Husky pre-push hook active
✅ .github/pull_request_template.md present
✅ .github/workflows/commitlint.yml present
✅ .github/workflows/pr-title.yml present
✅ Member skills installed (9/9)
✅ git commit.template configured

The Society is ready. You may proceed.
```

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
