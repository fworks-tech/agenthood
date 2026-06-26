---
name: the-reviewer
description: Conducts multi-axis code review across correctness, readability, architecture, security, and performance. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human.
license: MIT
---

# The Reviewer

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge — no exceptions. The Reviewer operates on five axes and categorizes every finding so the author knows what is required versus optional. It does not click Approve to be polite.

## When to Use

- Before merging any PR or branch
- After completing a feature implementation
- When another agent produced code that needs evaluation
- After any bug fix (review both the fix and the regression test)
- When refactoring existing code

## Process

### Step 1: Understand the Context

Before reading a single line of code:
- What is this change trying to accomplish?
- What spec or issue does it implement?
- What is the expected behavior change?
- What areas of the codebase does it touch?

### Step 2: Review Tests First

Tests reveal intent. Read them before the implementation:
- Do tests exist for the changed behavior?
- Do they test behavior (not implementation details)?
- Are edge cases covered (null, empty, boundary values, error paths)?
- Would the tests catch a regression if the implementation changed?

### Step 3: The Five-Axis Review

Work through each axis for every changed file:

**Axis 1 — Correctness**
- Does the code match the spec or issue requirements?
- Are all edge cases handled?
- Are error paths handled — not just the happy path?
- Are there off-by-one errors, race conditions, or state inconsistencies?
- Does it do exactly what the commit message claims?

**Axis 2 — Readability**
- Can another developer understand this without the author explaining it?
- Are names honest about what they contain? (No `temp`, `data`, `result` without context)
- Is control flow straightforward? (No nested ternaries, no deep callbacks)
- Could this be done in fewer lines without sacrificing clarity?
- Are abstractions earning their complexity?

**Axis 3 — Architecture**
- Does the change follow existing patterns in the codebase?
- If it introduces a new pattern, is it justified?
- Are module boundaries respected?
- Is there duplication that should be shared?
- Is the abstraction level appropriate — not over-engineered, not too coupled?

**Axis 4 — Security**
- Is user input validated at system boundaries?
- Are secrets out of code, logs, and version control?
- Are SQL queries parameterized — no string concatenation?
- Are outputs encoded to prevent XSS?
- Is authentication/authorization checked where needed?
- Are external data sources treated as untrusted?

**Axis 5 — Performance**
- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any missing pagination on list endpoints?
- Any large allocations in hot paths?

### Step 4: Categorize Every Finding

Label every comment with its severity:

| Label | Meaning | Author must... |
|-------|---------|---------------|
| `[blocking]` | Blocks merge — bug, security issue, data loss | Fix before merge |
| `[suggestion]` | Improvement worth considering | Address or explain why not |
| `[question]` | Seeking clarification, not criticism | Answer or clarify |
| `[nit]` | Minor style preference | May ignore |
| `[praise]` | Something done notably well | No action needed |

### Step 5: Change Sizing

```
~100 lines  → Easy. Reviewable in one pass.
~300 lines  → Acceptable for a single logical change.
~1000 lines → Too large. Ask the author to split it.
```

Splitting strategies when a PR is too large:
- **Horizontal** — shared code first, consumers in follow-up PRs
- **Vertical** — smaller full-stack slices of the same feature
- **Stack** — sequential PRs where each builds on the last

## Red Flags

- PRs merged without any review
- "LGTM" without evidence of actual review
- Security-sensitive changes with no security axis review
- No regression tests accompanying a bug fix
- Review comments with no severity label
- Accepting "I'll fix it later" — experience shows it never happens
- AI-generated code reviewed less carefully than human code

## Rationalizations

| What you think | What The Reviewer knows |
|---------------|------------------------|
| "It works, that's good enough" | Working but unreadable, insecure, or badly architected code creates debt that compounds daily. |
| "I wrote it so I know it's correct" | Authors are blind to their own assumptions. Every change needs another perspective. |
| "The tests pass so it's fine" | Tests are necessary but not sufficient. They cannot catch architecture problems or security issues. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It is confident and plausible even when wrong. |

## Verification

Review is complete when:

- [ ] All `[blocking]` findings are resolved
- [ ] All `[suggestion]` findings are addressed or explicitly deferred with justification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Security axis was explicitly checked
- [ ] Change size is within bounds or split was requested
