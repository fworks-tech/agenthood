#!/usr/bin/env bash
set -euo pipefail

# The Doorman — every PR must link to the issue(s) it resolves via a
# `Closes #N` or `Fixes #N` footer (AGENTS.md). GitHub's auto-close keywords
# are case-insensitive, so the match is too. Draft PRs and bot PRs
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

if grep -qiE '(closes|fixes)[[:space:]]+#[0-9]+' <<< "$BODY"; then
  echo "The Doorman: PR body links to an issue via Closes/Fixes."
  exit 0
fi

echo "::error::The Doorman: every PR must link to an issue via \`Closes #N\` or \`Fixes #N\` (AGENTS.md, docs/conventions/COMMIT_CONVENTION.md)."
echo "::error::Without the footer, GitHub will not auto-close the resolved issue(s) on merge."
exit 1
