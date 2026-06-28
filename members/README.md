# The Members

Every member of the Agenthood is a specialist.
Each has a README describing their identity, responsibilities, and usage.
Each has a skill file that your agent runtime loads to activate them.

---

| Member | Tagline | Skill File |
|--------|---------|-----------|
| [The Scribe](the-scribe/SKILL.md) | *Turns your diff into prose worth reading* | `the-scribe/SKILL.md` |
| [The Architect](the-architect/SKILL.md) | *No code before the blueprint* | `the-architect/SKILL.md` |
| [The Reviewer](the-reviewer/SKILL.md) | *Five axes. No mercy. All respect.* | `the-reviewer/SKILL.md` |
| [The Tester](the-tester/SKILL.md) | *Red. Green. Refactor. Repeat.* | `the-tester/SKILL.md` |
| [The Debugger](the-debugger/SKILL.md) | *Five steps to every root cause. No guessing allowed.* | `the-debugger/SKILL.md` |
| [The Auditor](the-auditor/SKILL.md) | *Reads everything. Trusts nothing.* | `the-auditor/SKILL.md` |
| [The Herald](the-herald/SKILL.md) | *Announces with ceremony. Ships with precision.* | `the-herald/SKILL.md` |
| [The Librarian](the-librarian/SKILL.md) | *Every decision, recorded for posterity.* | `the-librarian/SKILL.md` |
| [The Doorman](the-doorman/SKILL.md) | *Nothing gets in without proper credentials.* | `the-doorman/SKILL.md` |
| [The Oracle](the-oracle/SKILL.md) | *Ask me anything about the Society. I have read every scroll.* | `the-oracle/SKILL.md` |
| [The Envoy](the-envoy/SKILL.md) | *One Society. Every runtime. No exceptions.* | `the-envoy/SKILL.md` |
| [The Sentinel](the-sentinel/SKILL.md) | *The Society cannot enforce standards it no longer understands.* | `the-sentinel/SKILL.md` |
| [The Warden](the-warden/SKILL.md) | *The chaos does not arrive all at once. I am here for the accumulation.* | `the-warden/SKILL.md` |
| [The Strategist](the-strategist/SKILL.md) | *The right solution starts with the right problem.* | `the-strategist/SKILL.md` |
| [The Operator](the-operator/SKILL.md) | *Health is not a goal; it is a practice.* | `the-operator/SKILL.md` |
| [The Steward](the-steward/SKILL.md) | *I was born from the situation I exist to prevent.* | `the-steward/SKILL.md` |

---

## One Canonical Skill File Per Member

Each member directory contains a single canonical skill file:

| File | Audience | Contents |
|------|----------|----------|
| `SKILL.md` | **Everyone** — the Society itself and adopter projects via `npx agenthood activate <member>` | Project-independent. Uses placeholders like "repository owner" and `{owner}/{repo}`. Includes `license: MIT` in frontmatter. The CLI copies this file into adopter projects (renamed to `<member>.md` at the destination, preserving the installed filename existing adopters already have). |

When a member's behaviour changes, **only `SKILL.md` needs to be updated** — there is no longer a parallel internal file to keep in sync. Project-specific configuration (GitHub org, label names, milestones) belongs in `.agenthood/config.json`, `AGENTS.md`, or `.github/labeler.yml` — not hardcoded in the skill.

---

## Loading Members into Your Agent Runtime

**Claude Code:**
```bash
cp -r agenthood/members/ yourproject/.claude/skills/
```

**Agent-agnostic (AGENTS.md):**
Reference `members/` in your project's `AGENTS.md` to make all runtimes aware.

**Via `npx agenthood init`:**
The initiation ceremony copies selected member skills into the correct directory
for your chosen AI runtime automatically.

---

## Invoking Members via the Autonomous Runtime

With the TypeScript runtime built, any member can be invoked directly as a real
LLM agent — no manual copy-paste into an AI assistant required.

```bash
# Build the runtime (once, after install)
npm run build

# Set the LLM provider key in your environment (do NOT commit it)
# Set GROQ_API_KEY in your shell profile or CI secrets (free at console.groq.com)
# or use Ollama for fully offline execution — no key required

# Invoke any member by name
npx agenthood run the-scribe "write a commit message for the current diff"
npx agenthood run the-reviewer "review the changes against the spec in issue #12"
npx agenthood run the-architect "plan the OAuth2 integration"
npx agenthood run the-auditor "run a security audit on the authentication module"

# List all available members
npx agenthood list
```

The runtime loads each member's `SKILL.md` file at execution time.
The files are read-only — the runtime never modifies them.

See [ADR-008](../docs/adr/ADR-008-typescript-runtime-over-python.md) and
[ADR-009](../docs/adr/ADR-009-groq-as-default-llm-provider.md) for design decisions.

---

## The Member Lifecycle

A member is activated when called. It operates within its specialty.
It defers to other members when the task crosses disciplines.
The Scribe does not review code — it calls The Reviewer.
The Doorman does not write docs — it calls The Librarian.

The Society works because each member knows their lane.
