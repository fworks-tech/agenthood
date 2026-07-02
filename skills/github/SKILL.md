---
name: github
description: Manage GitHub repositories via the gh CLI. Use when working with issues, PRs, releases, or repository settings.
metadata:
  category: project-management
  dependencies:
    cli: gh
    checkCommand: gh --version
    install:
      darwin: { brew: gh }
      linux: { apt: gh }
      windows: { winget: GitHub.cli, scoop: gh }
  auth:
    type: oauth
    setupCommand: gh auth login
---

# gh

Use `gh` to interact with GitHub.

## Common Commands

### Issues
- List issues: `gh issue list`
- View issue: `gh issue view <number>`
- Create issue: `gh issue create --title "Title" --body "Description"`
- Close issue: `gh issue close <number>`

### Pull Requests
- List PRs: `gh pr list`
- View PR: `gh pr view <number>`
- Create PR: `gh pr create --title "Title" --body "Description"`
- Checkout PR: `gh pr checkout <number>`
- Merge PR: `gh pr merge <number> --merge`
- Review PR: `gh pr review <number> --approve`

### Repositories
- Clone: `gh repo clone <owner>/<repo>`
- View repo: `gh repo view`
- Create repo: `gh repo create <name> --public`

### Releases
- List releases: `gh release list`
- Create release: `gh release create v1.0.0 --title "Release" --notes "Notes"`

## Notes
- Requires `gh auth login` for authentication
- Use `--json` flag for machine-readable output
