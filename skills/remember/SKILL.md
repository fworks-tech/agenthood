---
name: remember
description: Reviews conversation history and captures valuable knowledge — best practices, coding conventions, architecture decisions, workflows, and user feedback — into persistent memory (AGENTS.md) or reusable skills. Use when the user says "remember this", "save what we learned", "update memory", or "capture learnings".
license: MIT
---

# The Rememberer

## Overview

The Rememberer converts conversation into institutional knowledge. Most sessions produce best practices that die with the session — the Rememberer scans the conversation, classifies each learning as a guideline or a workflow, and stores it where it will actually be found again: memory for preferences, skills for processes. The most important things to preserve are the best practices the session discovered.

## When to Use

- The user asks to remember, save, or capture something from the session
- A session produced patterns, conventions, or decisions worth keeping
- A workflow or methodology was developed that should be reusable
- Feedback was given about behavior or outputs that should persist

## Process

### 1. Identify Best Practices and Key Learnings

Scan the conversation for:

**Best practices (highest priority)**
- **Patterns that worked well** — approaches, techniques, or solutions found effective
- **Anti-patterns to avoid** — mistakes, gotchas, or approaches that caused problems
- **Quality standards** — criteria established for good code, documentation, or processes
- **Decision rationale** — why one approach was chosen over another

**Other valuable knowledge**
- Coding conventions and style preferences
- Project architecture decisions
- Workflows and processes developed
- Tools, libraries, or techniques worth remembering
- Feedback given about behavior or outputs

### 2. Decide Where to Store Each Learning

For each learning, choose the right destination:

**Memory (AGENTS.md) for preferences and guidelines** — use when the knowledge is a preference or guideline (not a multi-step process), something to always keep in mind, or a simple rule or pattern.

**Skill for reusable workflows and methodologies** — create a skill when the session developed a multi-step process worth reusing, a methodology for a specific type of task, a workflow with best practices baked in, or a procedure that should be followed consistently.

Skills are more powerful than memory entries because they encode *how* to do something well, not just *what* to remember.

### 3. Create Skills for Significant Best Practices

If the session established best practices around a workflow, capture them in a skill with the standard structure (SKILL.md required; scripts/, references/, assets/ optional). Follow the key principles:

1. **Encode best practices prominently** — put them near the top so they guide the entire workflow
2. **Concise is key** — only include non-obvious knowledge; every paragraph should justify its token cost
3. **Clear triggers** — the description determines when the skill activates; be specific
4. **Imperative form** — write as commands: "Create a file", not "You should create a file"
5. **Include anti-patterns** — what NOT to do is often as valuable as what to do

### 4. Update Memory for Simpler Learnings

For preferences, guidelines, and simple rules that do not warrant a full skill, record them as memory entries:

```markdown
## Best Practices
- When doing X, always Y because Z
- Avoid A because it leads to B
```

### 5. Summarize Changes

List what was captured and where it was stored:
- Skills created, with the key best practices encoded
- Memory entries added, with their location

## Red Flags

- Letting a session's best practices die with the session
- Storing a workflow in memory — processes belong in skills, preferences in memory
- Skills without a clear trigger description — they will never activate
- Prose that repeats what any reader already knows — token cost without value
- Capturing without a summary — the user must see what changed and where

## Rationalizations

| What you think | What The Rememberer knows |
|----------------|---------------------------|
| "I'll remember it myself" | You will not — the next session starts fresh. Write it where the next session looks. |
| "That's obvious, no need to record it" | What is obvious to you now is invisible to you in six months. |
| "I'll save it all in one big file" | Classification matters: preferences in memory, processes in skills. Unclassified knowledge is unfindable knowledge. |
| "Recording this takes too long" | The cost of one minute of capture is repaid by every future session that does not rediscover it. |

## Verification

The capture is complete when:

- [ ] Conversation scanned for best practices and key learnings
- [ ] Each learning classified: memory (guideline) vs skill (workflow)
- [ ] Skills created with best practices prominent, clear triggers, imperative form, anti-patterns included
- [ ] Memory updated for simpler preferences and rules
- [ ] A summary lists what was captured and where it is stored
