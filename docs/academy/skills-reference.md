# Skills Reference

> *Fourteen members. Fourteen specializations. Zero overlap.*

---

## Engineering

### The Scribe

> *Turns your diff into prose worth reading.*

**Specialty:** Commit messages, PR descriptions, changelogs
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`, `pr_sync`
**Runtime:** `npx agenthood run the-scribe "write a commit message for the current diff"`

### The Architect

> *No code before the blueprint.*

**Specialty:** System design, ADRs, task decomposition, tech decisions
**Tools:** `read_file`, `write_file`, `write_code`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-architect "plan the implementation for issue #42"`

### The Tester

> *Red. Green. Refactor. Repeat.*

**Specialty:** TDD, test generation, coverage enforcement, edge cases
**Tools:** `read_file`, `write_file`, `write_code`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-tester "write tests for the auth module"`

### The Debugger

> *Five steps to every root cause. No guessing allowed.*

**Specialty:** Error triage, root cause analysis, systematic recovery
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-debugger "diagnose the CI failure"`

---

## Validation

### The Reviewer

> *Five axes. No mercy. All respect.*

**Specialty:** Code review across correctness, readability, architecture, security, performance
**Tools:** `read_file`, `write_file`
**Runtime:** `npx agenthood run the-reviewer "review the latest commit"`

### The Auditor

> *Reads everything. Trusts nothing.*

**Specialty:** Security review, dependency audit, secrets scanning, OWASP Top 10
**Tools:** `read_file`, `write_file`, `search_codebase`
**Runtime:** `npx agenthood run the-auditor "audit the authentication module"`

### The Doorman

> *Nothing gets in without proper credentials.*

**Specialty:** Commit message validation, branch protection, health checks, enforcement
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-doorman "validate the current branch"`

### The Sentinel

> *The Society cannot enforce standards it no longer understands.*

**Specialty:** Member file integrity, cross-member contradiction detection, structural drift
**Tools:** `read_file`, `write_file`, `search_codebase`
**Runtime:** `npx agenthood run the-sentinel "audit member files for consistency"`

### The Warden

> *The chaos does not arrive all at once. I am here for the accumulation.*

**Specialty:** Code smell detection, complexity enforcement, architectural boundary violations
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-warden "scan for code smells"`

---

## Knowledge

### The Librarian

> *Every decision, recorded for posterity.*

**Specialty:** Documentation management, ADR creation, API references, knowledge management
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-librarian "document the API endpoints"`

### The Oracle

> *Ask me anything about the Society. I have read every scroll.*

**Specialty:** Institutional knowledge, member authoring templates, naming guidance, convention rationale
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-oracle "what members should I activate for a library project?"`

---

## Lifecycle

### The Herald

> *Announces with ceremony. Ships with precision.*

**Specialty:** Semantic versioning, changelog generation, release notes, scheduled reports
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-herald "generate the changelog for the next release"`

### The Envoy

> *One Society. Every runtime. No exceptions.*

**Specialty:** Cross-provider translation, bootstrap generation, convention validation across runtimes
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-envoy "translate skills for Copilot"`

### The Steward

> *I was born from the situation I exist to prevent.*

**Specialty:** Context economy, member routing, provider cache strategy, session triage
**Tools:** `read_file`, `write_file`, `search_codebase`, `explain_code`
**Runtime:** `npx agenthood run the-steward "optimize the agent configuration"`

---

## Special skills

### The Manuscript — PR body sync

Invoked via `pr_sync` skill or the `pr-sync` CLI command:

```bash
# Fast path (zero LLM, CI-friendly)
npx agenthood pr-sync --pr 42

# Context-aware path (loads full Society context)
npx agenthood run the-scribe "sync PR #42"
```

Read more in the [Getting Started guide](getting-started.md#the-manuscript--pr-sync).

---

*Fourteen members. One Society. Every member knows their lane.*
