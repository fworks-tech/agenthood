# Automation Workflows

A workflow that opens its own pull request is still a contributor: it follows
the branch, commit and PR conventions in the repository `AGENTS.md`.

## Branch and issue anchoring

Automation branches use `type/issue-NNN-short-description`, where `NNN` is a
tracking issue that stays open for as long as the workflow exists. One workflow
owns one branch and one pull request; a second PR from the same automation means
the first one was never resolved.

The number is fixed in the workflow file, not searched by label. A label search
can match a different issue between runs and split the automation across two
branches, which is the failure the naming convention exists to prevent. The
tracking issue body names the workflow, so a renumbering that skips either side
is visible in review.

| Workflow | Branch | Tracking issue |
|---|---|---|
| `opencode-catalog-sync.yml` | `chore/issue-NNN-opencode-catalog-sync` | fixed in `env.SYNC_ISSUE` |

A release PR (`chore/release-bump`) is a one-off branch created and consumed by
one release, so it does not carry a tracking issue number.

## Pull requests opened with `GITHUB_TOKEN`

A PR created by the default `GITHUB_TOKEN` does not start `push` or
`pull_request` workflows for its own branch (GitHub suppresses recursive runs).
A green workflow run therefore means the sync step succeeded, not that the PR
passed CI. The PR description says what the automation changed; a maintainer
runs the gates or pushes a commit under a personal token before merging.

## When the automatic branch already exists

The catalog sync forces its branch with `--force-with-lease` on every run that
finds a catalog difference, so a rebase is not needed. An unchanged catalog
exits before any branch or PR is touched, and a green run without a commit is
the expected result.
