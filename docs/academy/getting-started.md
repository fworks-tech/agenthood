# Getting Started with Agenthood

> *A full AI engineering team — install in five minutes, invoke on demand.*

---

## What is Agenthood

Agenthood is a suite of 14 specialized AI agents that automate the work around your code: commit messages, PR reviews, security audits, changelogs, and more. Two modes:

- **Runtime mode** (flagship) — agents run autonomously via the TypeScript CLI. They reason, use tools, and produce results without manual prompting.
- **Skill mode** (alternative) — members load as Markdown skill files into Claude Code, Copilot, or any agent runtime that supports skill files.

Both modes use the same 14 member definitions. Choose runtime for automation, skill mode for assisted workflows.

---

## Quick install

```bash
npm install --save-dev agenthood
npx agenthood init          # interactive setup (~2 minutes)
npx agenthood check         # verify everything is in place
```

Requirements: Node.js 22+, `git`, and `gh` CLI for PR sync. No API key required for basic setup.

---

## Essential commands

| Command | What it does |
|---------|-------------|
| `init` | Install hooks, templates, and member skills into your project |
| `check` | Health check — confirm the Society is fully operational |
| `run <member> "<task>"` | Invoke a member as an autonomous agent |
| `list` | List all 14 members with activation status |
| `pr-sync --pr <N>` | Auto-sync PR body with new commits (The Manuscript) |
| `activate <member>` | Enable a member's skill file in your runtime |
| `deactivate <member>` | Disable a member's skill file |
| `oath` | Read the Society oath |
| `eject` | Remove all Society files from your project |

---

## Your first commit workflow

1. **Write code** — make changes in your project.
2. **Stage** — `git add -p`
3. **Commit** — `git commit`. The Doorman validates your message against conventional commits. If it fails, you get a clear reason and a suggestion.
4. **Push** — pre-push hooks run tests before the branch leaves your machine.
5. **Open a PR** — the PR body is pre-filled with the Society's template (`## What changed`, `## Why`, `## How to test`).
6. **Review** — The Reviewer checks correctness, security, performance, maintainability, and test coverage.
7. **Release** — The Herald determines the semver bump, generates the changelog, and publishes to npm.

Every step is automated. Every step has a member responsible.

---

## CI pipeline

The Society ships 11 workflows that enforce standards on every push and PR:

| Workflow | Member | What it does |
|----------|--------|-------------|
| `commitlint.yml` | The Doorman | Validates commit messages match conventional commits |
| `auto-assign.yml` | The Scribe | Assigns an owner to new issues and PRs |
| `labeler.yml` | The Scribe | Labels PRs by changed file paths |
| `scribe-pr-body.yml` | The Reviewer | Reviews every pushed diff via LLM, posts findings as PR comment |
| `herald.yml` | The Herald | Posts a CI summary comment on every PR |
| `semantic-release.yml` | The Herald | Automated release and npm publish |
| `auditor.yml` | The Auditor | Scans for secrets and credentials |
| `librarian.yml` | The Librarian | Checks documentation stays in sync with code |
| `sentinel.yml` | The Sentinel | Validates member file structure and integrity |
| `tester.yml` | The Tester | Runs the full test suite |
| `warden.yml` | The Warden | Enforces file size and code health limits |
| `vscode-extension.yml` | The Envoy | Builds and tests the VS Code extension |

These run on GitHub Actions. Every check must pass before merge.

---

## The Manuscript — PR sync

The Scribe keeps PR descriptions accurate as new commits land. A `<!-- pr-sync: sha=... -->` marker splits the body into two zones: your narrative above, auto-generated content below.

```bash
# Fast path — no API key required, runs in CI
npx agenthood pr-sync --pr 42

# Preview changes without publishing
npx agenthood pr-sync --pr 42 --dry-run

# Context-aware — The Scribe loads your conventions and ADRs first
agenthood run the-scribe "sync PR #42"
```

On each run, The Scribe detects new commits since the last sync, updates the `## What Changed` section, and posts a reviewer comment. Your `## Why` and `## How to Test` sections are never touched.

For the full breakdown, see the [Skills Reference](skills-reference.md).

---

## Configuration

The Society reads from `.agenthood/config.json`, scaffolded by `init`:

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

**Key environment variables:**

| Variable | Required for | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Runtime mode (free at console.groq.com) | — |
| `ANTHROPIC_API_KEY` | Runtime mode, high-complexity tasks | — |
| `OPENAI_API_KEY` | Runtime mode (fallback provider) | — |
| `GITHUB_TOKEN` | PR sync (auto-set in CI) | — |

No API key is needed for skill-file mode or for `pr-sync` in CI.

---

## Alternative path: skill files

If you use Claude Code, Copilot, or another assistant, load members as skill files:

```bash
npx agenthood init
# Select your runtime when prompted — skills are installed automatically
```

The assistant loads the member's SKILL.md as context. Ask the Reviewer to check your PR, ask the Auditor to scan your auth flow. They know their role.

---

## Next steps

- [Skills Reference](skills-reference.md) — all 14 members, their tools, and invocation syntax
- [Level 1: GenAI & RAG Basics](level-1-genai-rag-basics/) — LLMs, prompt engineering, RAG
- [Level 2: AI Agent Essentials](level-2-agent-essentials/) — memory, planning, multi-agent
- [Level 3: Advanced Agent Skills](level-3-advanced-skills/) — integration, performance, production
- [Architecture Decision Records](../adr/) — why the Society is built the way it is

---

*Install in five minutes. The standards last forever.*
