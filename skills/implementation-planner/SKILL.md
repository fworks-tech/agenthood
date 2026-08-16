---
name: implementation-planner
description: Creates detailed implementation plans and technical specifications in markdown — feature breakdown, phased tasks with complexity estimates, risks, and success criteria. Use before starting a non-trivial feature to turn requirements into an executable roadmap.
license: MIT
---

# The Implementation Planner

## Overview

The Implementation Planner turns a feature into a roadmap. It analyzes requirements, breaks them into phases of actionable tasks with complexity estimates and dependencies, and writes the plan down so a team can follow it without re-deriving it. Planning exists to surface contradictions cheaply — before code, not during it.

## When to Use

- A feature needs to be broken down before coding starts
- A task needs phases, dependencies, and complexity estimates
- A technical approach needs to be written down for a team to follow
- A plan needs to identify risks and assumptions before they become surprises

## Process

### 1. Analyze Requirements
- What problem are we solving and why?
- Define success criteria — what does "done" look like?
- Who will use this and how?

### 2. Define the Technical Approach
- High-level architecture and key technology choices
- Important APIs, data structures, or integrations
- Major technical decisions and their trade-offs

### 3. Write the Implementation Plan
Break work into logical phases. For smaller projects, phases might be days; for larger ones, weeks or sprints:

**Phase 1: Foundation** — core structure (models, database, basic framework), essential configuration and dependencies

**Phase 2: Core Functionality** — primary features and user workflows, business logic and key integrations

**Phase 3: Polish & Deploy** — error handling, testing, and edge cases; documentation and deployment preparation

For each phase, list specific tasks with complexity estimates (Small/Medium/Large) and any dependencies.

### 4. Document Considerations
- **Assumptions**: What are we taking for granted?
- **Constraints**: Time, budget, or technical limitations
- **Risks**: What could go wrong and how to handle it?

### 5. Scope the Boundaries
- **Not Included**: features or improvements saved for later versions
- Nice-to-have items that are not essential

Adjust the detail level to the project — solo projects need less formal documentation, team projects benefit from thorough planning. The plan is a roadmap that keeps progress organized and visible.

## Red Flags

- A plan that starts with code structure before stating the problem
- Success criteria that cannot be measured
- Phases without dependencies — tasks that assume invisible prerequisites
- Assumptions that go undocumented ("the database is already there")
- A plan with no "not included" section — scope creep by omission

## Rationalizations

| What you think | What The Implementation Planner knows |
|----------------|---------------------------------------|
| "I know the requirements, let's just code" | Contradictions are cheapest to find in a plan. Code finds them at merge time. |
| "Estimates are always wrong anyway" | Estimates are about ordering and dependencies, not precision. Without them, sequencing is guesswork. |
| "Risks slow us down" | Named risks get mitigated. Unnamed risks become incidents. |
| "This is a small feature, no plan needed" | Small features get small plans — not no plan. One paragraph still prevents drift. |

## Verification

The plan is complete when:

- [ ] Problem, success criteria, and users are stated
- [ ] Technical approach documents key decisions and trade-offs
- [ ] Work is phased (foundation → core → polish) with per-task complexity and dependencies
- [ ] Assumptions, constraints, and risks are listed
- [ ] Out-of-scope items are explicitly excluded
- [ ] The plan is written to a markdown file a team can follow
