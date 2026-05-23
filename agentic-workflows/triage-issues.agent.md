---
description: Automatically triages new GitHub issues — applies labels, assigns to milestone, asks clarifying questions if needed, and links related issues.
on:
  issues:
    types: [opened]
permissions: read-all
safe-outputs:
  - add-label
  - add-comment
  - assign-milestone
---

# Triage New Issues

When a new issue is opened, perform the following triage steps.

## Steps

1. **Read the issue** title, body, and any attached context carefully

2. **Classify the type** based on content:
   - Describes broken behavior → `bug`
   - Requests new capability → `feature`
   - Asks a question → `question`
   - Relates to docs → `documentation`
   - Relates to infrastructure → `type/infra`

3. **Classify the area** based on files or systems mentioned:
   - Frontend / UI → `frontend`
   - API / backend → `backend`, `api`
   - CI/CD → `devops`
   - Canvas/drawing → `canvas`

4. **Assign priority** based on impact described:
   - Data loss, security, or complete breakage → `priority-critical`
   - Significant user impact, blocked workflow → `priority-high`
   - Degraded experience, workaround exists → `priority-medium`
   - Minor inconvenience, nice to have → `priority-low`

5. **Apply labels** from the above classifications

6. **Search for related issues** using keywords from the title
   - If related issues found, add a comment: *"Related to #{N} — [title]"*

7. **Ask clarifying questions** if the issue is missing:
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior (for bugs)
   - Use case or motivation (for features)
   - Environment details if relevant

   Post as a single comment with all questions at once — not multiple comments.

8. **Assign to milestone** if the issue clearly belongs to an active milestone

## Comment Template for Clarification

```
Thank you for opening this issue!

To help us address this effectively, could you provide:

- [ ] Steps to reproduce the issue
- [ ] What you expected to happen
- [ ] What actually happened
- [ ] Your environment (OS, browser, version)

The more detail you can share, the faster we can help.

*— The Doorman, Agenthood*
```

## Notes
- Never close an issue during triage — only label and comment
- If the issue is clearly a duplicate, add `duplicate` label and link to the original
- This workflow runs with read-only permissions; labels and comments are safe outputs
