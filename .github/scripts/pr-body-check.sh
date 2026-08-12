#!/usr/bin/env bash
set -euo pipefail

# The Doorman — every PR must link to the issue(s) it resolves via a GitHub
# closing keyword (`close`, `closes`, `closed`, `fix`, `fixes`, `fixed`,
# `resolve`, `resolves`, `resolved`) plus an issue number (AGENTS.md). The
# keyword is case-insensitive, may be followed by an optional colon, and the
# issue number may be written with or without `#`. Draft PRs and bot PRs
# (Dependabot/Renovate) are skipped by the calling workflow.

PR_NUMBER="${PR_NUMBER:-}"
if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "::error::pr-body-check: invalid PR number: $PR_NUMBER"
  exit 1
fi

if [[ -n "${PR_BODY:-}" ]]; then
  BODY="$PR_BODY"
else
  BODY=$(gh pr view "$PR_NUMBER" --repo "${GITHUB_REPOSITORY:?}" --json body --jq .body)
fi

if grep -qiE '\b(clos(e[sd]?)?|fix(e[sd]?)?|resolve[sd]?)\b[[:space:]]*:?[[:space:]]*#?[0-9]+' <<< "$BODY"; then
  echo "The Doorman: PR body links to an issue via a closing keyword."
  exit 0
fi

echo "::error::The Doorman: every PR must link to an issue via a GitHub closing keyword (Closes #N, Fixes #N, Resolves #N) (AGENTS.md, docs/conventions/COMMIT_CONVENTION.md)."
echo "::error::Without the footer, GitHub will not auto-close the resolved issue(s) on merge."
exit 1
