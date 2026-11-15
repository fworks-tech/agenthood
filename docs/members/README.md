# The Members

Every member of the Agenthood is a specialist.
Each has a README describing their identity, responsibilities, and usage.
Each has a skill file that your agent runtime loads to activate them.

---

| Member | Tagline | Skill File |
|--------|---------|-----------|
| [The Scribe](../../skills/scribe/SKILL.md) | *Turns your diff into prose worth reading* | `skills/scribe/SKILL.md` |
| [The Architect](../../skills/architect/SKILL.md) | *No code before the blueprint* | `skills/architect/SKILL.md` |
| [The Builder](../../skills/builder/SKILL.md) | *Builds the smallest verified change* | `skills/builder/SKILL.md` |
| [The Reviewer](../../skills/reviewer/SKILL.md) | *Five axes. No mercy. All respect.* | `skills/reviewer/SKILL.md` |
| [The Tester](../../skills/tester/SKILL.md) | *Red. Green. Refactor. Repeat.* | `skills/tester/SKILL.md` |
| [The Debugger](../../skills/debugger/SKILL.md) | *Five steps to every root cause. No guessing allowed.* | `skills/debugger/SKILL.md` |
| [The Auditor](../../skills/auditor/SKILL.md) | *Reads everything. Trusts nothing.* | `skills/auditor/SKILL.md` |
| [The Herald](../../skills/herald/SKILL.md) | *Announces with ceremony. Ships with precision.* | `skills/herald/SKILL.md` |
| [The Librarian](../../skills/librarian/SKILL.md) | *Every decision, recorded for posterity.* | `skills/librarian/SKILL.md` |
| [The Doorman](../../skills/doorman/SKILL.md) | *Nothing gets in without proper credentials.* | `skills/doorman/SKILL.md` |
| [The Oracle](../../skills/oracle/SKILL.md) | *Ask me anything about the Society. I have read every scroll.* | `skills/oracle/SKILL.md` |
| [The Envoy](../../skills/envoy/SKILL.md) | *One Society. Every runtime. No exceptions.* | `skills/envoy/SKILL.md` |
| [The Sentinel](../../skills/sentinel/SKILL.md) | *The Society cannot enforce standards it no longer understands.* | `skills/sentinel/SKILL.md` |
| [The Warden](../../skills/warden/SKILL.md) | *The chaos does not arrive all at once. I am here for the accumulation.* | `skills/warden/SKILL.md` |
| [The Strategist](../../skills/strategist/SKILL.md) | *The right solution starts with the right problem.* | `skills/strategist/SKILL.md` |
| [The Mediator](../../skills/mediator/SKILL.md) | *First in line — intent routing* | `skills/mediator/SKILL.md` |
| [The Operator](../../skills/operator/SKILL.md) | *Health is not a goal; it is a practice.* | `skills/operator/SKILL.md` |
| [The Steward](../../skills/steward/SKILL.md) | *I was born from the situation I exist to prevent.* | `skills/steward/SKILL.md` |
| [The Inspector](../../skills/inspector/SKILL.md) | *Every pixel accounted for. Every boundary crossed with intent.* | `skills/inspector/SKILL.md` |
| [The Mailman](../../skills/mailman/SKILL.md) | *Neither snow nor rain nor API rate limits shall stay this courier from the swift completion of their rounds.* | `skills/mailman/SKILL.md` |

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
cp -r agenthood/skills/ yourproject/.claude/skills/
```

**Agent-agnostic (AGENTS.md):**
Reference `skills/` in your project's `AGENTS.md` to make all runtimes aware.

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
npx agenthood run scribe "write a commit message for the current diff"
npx agenthood run reviewer "review the changes against the spec in issue #12"
npx agenthood run architect "plan the OAuth2 integration"
npx agenthood run auditor "run a security audit on the authentication module"

# List all available members
npx agenthood list
```

The runtime loads each member's `SKILL.md` file at execution time.
The files are read-only — the runtime never modifies them.

Each run records a decision + provenance entry (`.agenthood/decisions/`,
`.agenthood/provenance/`) — the tamper-evident audit trail behind every member
action ([ADR-015](../adr/ADR-015-decision-intelligence-and-provenance.md)).

See [ADR-008](../adr/ADR-008-typescript-runtime-over-python.md) and
[ADR-009](../adr/ADR-009-groq-as-default-llm-provider.md) for design decisions.

---

## The Member Lifecycle

A member is activated when called. It operates within its specialty.
It defers to other members when the task crosses disciplines.
The Scribe does not review code — it calls The Reviewer.
The Doorman does not write docs — it calls The Librarian.

The Society works because each member knows their lane.
