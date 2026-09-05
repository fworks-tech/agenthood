---
name: mcp-github
description: Use when reviewing PRs, checking CI status, or interacting with GitHub via MCP. Requires the GitHub MCP server to be configured in opencode.json or .agenthood/config.json.
license: MIT
---

# MCP GitHub

## Overview

MCP GitHub demonstrates the Skills + MCP pattern. The skill defines the procedure for PR review; the GitHub MCP server provides API access. Together they enable automated PR workflows.

## When to Use

- When reviewing pull requests via GitHub
- When checking CI/build status on PRs
- When posting review comments or approvals
- When searching issues or code on GitHub

## Process

### Review a PR

1. Use GitHub MCP to list open PRs in the repository
2. Read the PR diff and description
3. Check CI status — all checks must pass
4. Review for:
   - Correctness: does the code do what it claims?
   - Tests: are new behaviors tested?
   - Security: no secrets, no injection vectors
   - Style: matches repo conventions
5. Post review comments using GitHub MCP
6. Approve if all criteria pass, request changes if not

### Check CI Status

1. Use GitHub MCP to get PR status checks
2. List all check runs with their conclusions
3. Report failures with links to logs
4. Suggest next steps for fixing failures

### Post a Comment

1. Use GitHub MCP to create a review comment
2. Reference specific lines in the diff
3. Use conventional language: `[blocking]`, `[suggestion]`, `[nit]`

## Prerequisites

Configure the GitHub MCP server in `opencode.json`:

```json
{
  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://api.githubcopilot.com/mcp",
      "headers": {
        "Authorization": "Bearer {env:GITHUB_TOKEN}"
      }
    }
  }
}
```

Set the token: `export GITHUB_TOKEN=ghp_xxx`

## Red Flags

- Approving a PR without reading the full diff
- Posting comments without checking CI status first
- Using MCP tools without the skill loaded (no procedure)
- Hardcoding tokens in config (use `{env:VAR}`)

## Rationalizations

| What you think | What MCP GitHub knows |
|----------------|----------------------|
| "I'll just approve it quickly" | Quick approvals miss bugs. Follow the review checklist. |
| "MCP has access, I don't need the skill" | MCP provides access, not procedure. The skill defines what to check. |
| "I'll hardcode the token for now" | Hardcoded tokens leak in config files. Use environment variables. |

## Verification

Before confirming the review is done:

- [ ] All CI checks are green
- [ ] Full diff was read (not just the title)
- [ ] Review comments are specific and actionable
- [ ] Approval is justified by the checklist, not assumed
