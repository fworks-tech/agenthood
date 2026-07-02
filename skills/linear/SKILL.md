---
name: linear
description: Manage Linear issues and projects via the linear CLI. Use when viewing, creating, or updating Linear tasks.
metadata:
  category: project-management
  dependencies:
    cli: linear
    checkCommand: linear --version
    install:
      darwin: { brew: linear }
      linux: { script: "npm install -g @linear/cli" }
      windows: { scoop: linear }
  auth:
    type: api-key
    setupCommand: linear auth
---

# linear

Use `linear` to interact with Linear.

## Common Commands

### Issues
- List issues: `linear issue list`
- Create issue: `linear issue create --title "Title" --description "Description"`
- View issue: `linear issue view <id>`
- Update status: `linear issue update <id> --status done`

### Teams and Projects
- List teams: `linear team list`
- List projects: `linear project list`
- View project: `linear project view <id>`

### Search
- Search issues: `linear issue search "query"`
- My issues: `linear issue list --assignee @me`

## Notes
- API key from https://linear.app/settings/api
- Auth via `linear auth`
