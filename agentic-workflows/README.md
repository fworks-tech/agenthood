# Agentic Workflows

> *Templates for multi-step Society operations. Not automated — intentional.*

---

## What These Files Are

Each `.agent.md` file in this directory is a **manual-prompt template** — a
structured set of instructions you paste into your AI coding assistant to
perform a specific Society operation.

They are **not** deployed as automated GitHub Actions or `gh aw` workflows.
The frontmatter (`on:`, `permissions:`, `safe-outputs:`) describes the
*intended trigger and safety contract* for documentation purposes, not
a live automation configuration.

---

## Why Templates, Not Automation

Deploying these as automated workflows (via GitHub's `gh aw` extension or
similar) would require:

1. A stable, production-ready `gh aw` runtime with consistent behaviour
   across repositories
2. Credentials provisioned at the workflow level (GitHub token scopes,
   LLM API keys)
3. Per-project configuration for labels, milestones, and routing rules

These dependencies are not yet stable enough to prescribe for all adopters.
The template approach gives you the same structured process — with full
control over when and how it runs.

This decision is documented in [ADR-001](../docs/adr/ADR-001-markdown-skills-over-code-agents.md).

---

## Available Templates

| File | Trigger | Society Member | What it does |
|------|---------|----------------|-------------|
| [triage-issues.agent.md](triage-issues.agent.md) | New issue opened | The Doorman | Classifies, labels, and asks clarifying questions |
| [review-pr.agent.md](review-pr.agent.md) | PR opened or ready for review | The Reviewer | Five-axis review with structured findings |
| [diagnose-ci-failure.agent.md](diagnose-ci-failure.agent.md) | CI run fails | The Debugger | Root cause diagnosis posted as a PR comment |
| [sync-docs.agent.md](sync-docs.agent.md) | Merge to main | The Librarian | Checks for stale docs and opens a follow-up PR |

---

## How to Use a Template

1. Open your AI coding assistant (Claude Code, Copilot, Gemini CLI, etc.)
2. Load the relevant Society member skill — e.g., for PR review, load
   `members/the-reviewer/the-reviewer.md`
3. Paste the template's **Steps** section as your prompt
4. Add context: the issue body, PR diff, CI log, or merge commit as applicable
5. The member will follow the steps and produce the appropriate output

**Example — triaging a new issue in Claude Code:**

```
/load .claude/skills/the-doorman/the-doorman.md

A new issue was just opened: [paste issue URL or body]

Please follow the triage steps from the agentic-workflows/triage-issues.agent.md template.
```

---

## When These Become Automated

If `gh aw` or a similar runtime matures to the point where these templates
can be deployed reliably, the `on:` and `safe-outputs:` frontmatter fields
are already in the correct format for that transition.

Until then, the templates are the workflow.
