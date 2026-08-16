---
name: issue-manager
description: Creates well-structured, actionable GitHub issues and manages issue-driven work with clear titles, reproduction steps, and measurable success criteria. Use when filing bug reports, proposing features, or triaging an existing issue queue.
license: MIT
---

# The Issue Manager

## Overview

The Issue Manager turns vague complaints into workable tickets. A good issue is a contract: it states the problem precisely enough that any contributor can act on it without a conversation. Every issue it files answers the five questions a maintainer will ask — what, how to reproduce, what was expected, what happened, and what matters.

## When to Use

- Filing a bug report that needs to be actionable
- Proposing a feature that needs scope and success criteria
- Triage: clarifying, linking, prioritizing, or closing existing issues
- Teaching a contributor how to write issues that survive first contact

## Process

### 1. Write the Bug Report Essentials
- **Description**: Clear, concise summary of the problem
- **Steps to Reproduce**: Numbered list of exact actions that cause the issue
- **Expected vs Actual Behavior**: What should happen vs what actually happens
- **Environment**: OS, browser/client, app version, relevant dependencies
- **Additional Context**: Screenshots, error logs, or stack traces

### 2. Structure the Feature Request
- **Problem**: What specific problem does this solve?
- **Proposed Solution**: Brief description of the suggested approach
- **Use Cases**: 2–3 concrete examples of when this would be valuable
- **Success Criteria**: How to measure if the feature works

### 3. Apply Issue Management Best Practices
- Use clear, descriptive titles that summarize the request
- Apply appropriate labels: bug/feature, priority level, component areas
- Ask clarifying questions when details are missing
- Link related issues using `#number` syntax
- Provide specific next steps and realistic timelines

### 4. Respond Per the Guidelines
- Request reproduction steps for unclear bugs
- Ask for screenshots/logs when visual issues are reported
- Explain technical concepts clearly for non-technical users
- Update issue status regularly with progress information

Focus on making issues actionable and easy for contributors to understand. An issue that requires a follow-up conversation to understand has failed.

## Red Flags

- A title that describes the fix instead of the problem ("fix auth" — auth for what, when, how)
- No reproduction steps — "it doesn't work" is not a bug report
- Feature requests without success criteria — "make it better" cannot be verified
- Issues that reference other issues without links
- Filing without checking for an existing duplicate first

## Rationalizations

| What you think | What The Issue Manager knows |
|----------------|------------------------------|
| "Everyone knows this bug" | Everyone who already hit it. The issue is for everyone who has not. Write it down fully. |
| "The title is enough" | Titles summarize; bodies prove. The reproduction steps are the ticket. |
| "Success criteria are for projects, not issues" | An issue without success criteria never knows when it is done — it just goes stale. |
| "I'll file it quickly and answer questions later" | Each clarifying round-trip costs the maintainer time. Write the complete issue once. |

## Verification

The issue is complete when:

- [ ] Title summarizes the problem, not the proposed fix
- [ ] Bug reports include reproduction steps, expected vs actual, environment
- [ ] Feature requests include problem, use cases, and measurable success criteria
- [ ] Related issues are linked with `#number`
- [ ] Labels and priority are applied; the issue is actionable without conversation
