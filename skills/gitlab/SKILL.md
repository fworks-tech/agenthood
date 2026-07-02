---
name: gitlab
description: Manage GitLab repositories via the glab CLI. Use when working with merge requests, issues, or CI/CD pipelines.
metadata:
  category: project-management
  dependencies:
    cli: glab
    checkCommand: glab --version
    install:
      darwin: { brew: glab }
      linux: { apt: glab }
      windows: { scoop: glab }
  auth:
    type: oauth
    setupCommand: glab auth login
---

# glab

Use `glab` to interact with GitLab.

## Common Commands

### Merge Requests
- List MRs: `glab mr list`
- View MR: `glab mr view <id>`
- Create MR: `glab mr create --title "Title" --description "Description"`
- Merge MR: `glab mr merge <id>`
- Approve MR: `glab mr approve <id>`

### Issues
- List issues: `glab issue list`
- Create issue: `glab issue create --title "Title" --description "Description"`

### CI/CD
- List pipelines: `glab ci list`
- View pipeline: `glab ci view <id>`
- Run pipeline: `glab ci run`
- Pipeline status: `glab ci status`

### Repositories
- Clone: `glab repo clone <owner>/<repo>`

## Notes
- Requires `glab auth login` for authentication
- Config stored at `~/.config/glab-cli/`
