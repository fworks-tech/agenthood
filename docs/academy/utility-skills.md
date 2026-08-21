# Utility Skills

> *Beyond the Society's 20 members: specialist skills for tasks no member owns.*

The [Skills Reference](skills-reference.md) documents the Society members — the 19 roles the runtime can invoke with `npx agenthood run`. This page documents the utility skills: specialist capability files that any agent runtime loads from `skills/`, ported from the GitHub Copilot customization library and the deepagents project. They have no runtime invocation (they are not registered members) — they activate when their `description` matches the task at hand.

---

## Teaching & Explaining

### Concept Explainer

> *Every concept has a simple core buried under jargon.*

**What it does:** Breaks down complex technical concepts in beginner-friendly ways — everyday analogies first, terminology second, working examples always, with comprehension checks before moving on.

**When to use:** Explaining a technical topic to a learner, onboarding someone into unfamiliar code, writing educational documentation, answering "why does this work" with more than a one-liner.

**File:** [`skills/concept-explainer/SKILL.md`](../skills/concept-explainer/SKILL.md)
**Relation:** Complements The Librarian (documentation) — the Explainer teaches, the Librarian records.

### Debugging Tutor

> *The measure of success is whether the learner can fix the next one without help.*

**What it does:** Teaches systematic debugging as a skill: consistent reproduction, careful error-message reading, one change at a time, hypothesis formation, and pattern recognition — through leading questions rather than handed answers.

**When to use:** A learner is stuck on a bug and needs to build independent problem-solving skill, or a team repeatedly hits the same error categories.

**File:** [`skills/debugging-tutor/SKILL.md`](../skills/debugging-tutor/SKILL.md)
**Relation:** Complements The Debugger (diagnosis) and The Bug Fix Teammate (remediation) — the Tutor builds the skill, the others do the work.

### Onboarding Planner

> *Foundation, exploration, integration — a path from first day to first contribution.*

**What it does:** Creates personalized phased onboarding plans — environment setup with troubleshooting, codebase discovery with beginner-friendly first tasks, and team-process integration through early wins.

**When to use:** A new team member joins, a developer arrives with an unfamiliar stack, or onboarding documentation needs structure.

**File:** [`skills/onboarding-plan/SKILL.md`](../skills/onboarding-plan/SKILL.md)
**Relation:** Complements The Librarian (docs) and The Concept Explainer (learning material).

---

## Planning & Building

### Implementation Planner

> *Planning exists to surface contradictions cheaply — before code, not during it.*

**What it does:** Turns a feature into a phased roadmap: problem and success criteria, technical approach with trade-offs, phases (foundation → core functionality → polish & deploy) with per-task complexity estimates and dependencies, plus assumptions, constraints, risks, and an explicit out-of-scope list.

**When to use:** Before starting a non-trivial feature, when a task needs phases and dependencies, or when a plan must be written down for a team to follow.

**File:** [`skills/implementation-planner/SKILL.md`](../skills/implementation-planner/SKILL.md)
**Relation:** Sits between The Strategist (goal refinement) and The Architect (specs/ADRs) — more tactical than the Strategist, less formal than the Architect.

### Bug Fix Teammate

> *Fix the reported issue completely. Refactor nothing else.*

**What it does:** The remediation arm of debugging — scans for the most critical bugs, prioritizes by impact, reproduces and roots them, implements the minimal working fix, adds regression tests, and shares the knowledge gained.

**When to use:** A bug needs a complete fix with tests rather than a diagnosis, or the codebase needs bug triage.

**File:** [`skills/bug-fix-teammate/SKILL.md`](../skills/bug-fix-teammate/SKILL.md)
**Relation:** Complements The Debugger (diagnoses) and The Builder (implements) — action-oriented bug resolution with teaching.

### Cleanup Specialist

> *Simplifies safely. Nothing observable changes.*

**What it does:** Removes dead code, consolidates duplication, simplifies messy patterns, and applies consistent formatting across code and documentation — one improvement at a time, tested before and after, never adding features.

**When to use:** A file, directory, or codebase has accumulated dead code or duplication and needs maintainability work without behavior change.

**File:** [`skills/cleanup-specialist/SKILL.md`](../skills/cleanup-specialist/SKILL.md)
**Relation:** Complements The Warden (detects smells) — the Warden reports, the Specialist remediates.

---

## GitHub Workflow

### Issue Manager

> *An issue that requires a follow-up conversation to understand has failed.*

**What it does:** Turns vague complaints into workable tickets — bug report essentials (reproduction steps, expected vs actual, environment), structured feature requests (problem, use cases, success criteria), and triage best practices (labels, linking, clarifying questions).

**When to use:** Filing bug reports or feature requests, triaging an issue queue, or teaching contributors to write actionable issues.

**File:** [`skills/issue-manager/SKILL.md`](../skills/issue-manager/SKILL.md)
**Relation:** Complements The Doorman (standards enforcement) and The Scribe (communication) — no lane overlap.

### Pull Request Assistant

> *A PR is a contract between author and reviewers — draft it well, enforce it fairly.*

**What it does:** Generates complete PR descriptions (what/why/testing/breaking changes), runs review passes across security, performance, testing, and documentation, checks deployment requirements (migrations, env vars, feature flags), and formats feedback with issue/suggestion/why and emoji labels.

**When to use:** Opening a PR that needs a complete description, or reviewing one before merge.

**File:** [`skills/pull-request-assistant/SKILL.md`](../skills/pull-request-assistant/SKILL.md)
**Relation:** Overlaps The Scribe (PR descriptions) and The Reviewer (multi-axis review) — this is the combined, template-driven variant; the members remain canonical for runtime use.

---

## Quality

### Accessibility Auditor

> *A page that only works with a mouse is a page that does not work.*

**What it does:** Audits web interfaces against WCAG — semantic HTML first, ARIA requirements, keyboard navigation with visible focus, contrast ratios (4.5:1 text / 3:1 large text and UI), screen reader compatibility, accessible forms, and automated plus manual testing integration.

**When to use:** Generating or reviewing HTML, auditing an interface against accessibility standards, or designing forms and dynamic content.

**File:** [`skills/accessibility-auditor/SKILL.md`](../skills/accessibility-auditor/SKILL.md)
**Relation:** Complements The Auditor (security) — a specialized, WCAG-focused review lane.

---

## Memory

### Rememberer

> *Preferences in memory, processes in skills. Unclassified knowledge is unfindable knowledge.*

**What it does:** Scans conversation history, classifies learnings (best practices, anti-patterns, conventions, decision rationale) into memory entries for guidelines or skill files for reusable workflows, and summarizes what was captured and where.

**When to use:** "Remember this", "save what we learned", "update memory", or "capture learnings" — any session that produced knowledge worth keeping.

**File:** [`skills/remember/SKILL.md`](../skills/remember/SKILL.md)
**Relation:** Complements The Librarian (knowledge management) — the Rememberer captures from sessions, the Librarian curates the corpus.

---

## Related

- [Skills Reference](skills-reference.md) — the 20 Society members and their invocation
- [Built-in Tools](../architecture/built-in-tools.md) — canonical tool registry with scoping
- [Getting Started](getting-started.md) — install and first workflow

---

*One Society. Every member knows their lane — and every skill knows its task.*
