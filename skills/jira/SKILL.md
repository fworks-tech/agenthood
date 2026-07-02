---
name: jira
description: Manage Jira issues, sprints, and epics via the jira-cli. Use when viewing, creating, or updating Jira issues.
metadata:
  category: project-management
  dependencies:
    cli: jira
    checkCommand: jira version
    install:
      darwin: { brew: ankitpokhrel/jira-cli/jira-cli }
      linux: { script: "curl -fsSL https://raw.githubusercontent.com/ankitpokhrel/jira-cli/master/scripts/install.sh | sh" }
      windows: { scoop: jira-cli }
  config:
    - name: JIRA_API_TOKEN
      label: API Token
      type: secret
      required: true
    - name: JIRA_BASE_URL
      label: Jira Base URL
      type: string
      required: true
  auth:
    type: api-key
    setupCommand: jira init
---

# jira-cli

Use `jira` to interact with Jira.

## Common Commands

### Issues
- List issues: `jira issue list`
- View issue: `jira issue view <KEY>`
- Create issue: `jira issue create`
- Comment: `jira issue comment add <KEY> "Comment"`
- Assign: `jira issue assign <KEY> <USER>`

### Sprints
- List boards: `jira board list`
- List sprints: `jira sprint list --board <ID>`

### Search
- JQL search: `jira issue list --jql "project = PROJ AND status = 'In Progress'"`

## Notes
- API token from https://id.atlassian.com/manage-profile/security/api-tokens
- Config stored in `~/.jira/.config.yml`
