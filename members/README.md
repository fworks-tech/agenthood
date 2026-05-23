# The Members

The Agenthood has fourteen members. Each is a specialist.
Each has a README describing their identity, responsibilities, and usage.
Each has a skill file that your agent runtime loads to activate them.

---

| Member | Tagline | Skill File |
|--------|---------|-----------|
| [The Scribe](the-scribe/README.md) | *Turns your diff into prose worth reading* | `the-scribe.md` |
| [The Architect](the-architect/README.md) | *No code before the blueprint* | `the-architect.md` |
| [The Reviewer](the-reviewer/README.md) | *Five axes. No mercy. All respect.* | `the-reviewer.md` |
| [The Tester](the-tester/README.md) | *Red. Green. Refactor. Repeat.* | `the-tester.md` |
| [The Debugger](the-debugger/README.md) | *Five steps to every root cause. No guessing allowed.* | `the-debugger.md` |
| [The Auditor](the-auditor/README.md) | *Reads everything. Trusts nothing.* | `the-auditor.md` |
| [The Herald](the-herald/README.md) | *Announces with ceremony. Ships with precision.* | `the-herald.md` |
| [The Librarian](the-librarian/README.md) | *Every decision, recorded for posterity.* | `the-librarian.md` |
| [The Doorman](the-doorman/README.md) | *Nothing gets in without proper credentials.* | `the-doorman.md` |
| [The Oracle](the-oracle/README.md) | *Ask me anything about the Society. I have read every scroll.* | `the-oracle.md` |
| [The Envoy](the-envoy/README.md) | *One Society. Every runtime. No exceptions.* | `the-envoy.md` |
| [The Sentinel](the-sentinel/README.md) | *The Society cannot enforce standards it no longer understands.* | `the-sentinel.md` |
| [The Warden](the-warden/README.md) | *The chaos does not arrive all at once. I am here for the accumulation.* | `the-warden.md` |
| [The Steward](the-steward/README.md) | *I was born from the situation I exist to prevent.* | `the-steward.md` |

---

## Loading Members into Your Agent Runtime

**Claude Code:**
```bash
cp -r agenthood/members/ yourproject/.claude/skills/
```

**CodeBuddy:**
```bash
cp -r agenthood/members/ yourproject/.codebuddy/skills/
```

**Agent-agnostic (AGENTS.md):**
Reference `members/` in your project's `AGENTS.md` to make all runtimes aware.

---

## The Member Lifecycle

A member is activated when called. It operates within its specialty.
It defers to other members when the task crosses disciplines.
The Scribe does not review code — it calls The Reviewer.
The Doorman does not write docs — it calls The Librarian.

The Society works because each member knows their lane.
