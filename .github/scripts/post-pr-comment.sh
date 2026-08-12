#!/usr/bin/env bash
set -euo pipefail

# Post a PR comment from CI. Usage: post-pr-comment.sh <pr-number>
# The comment body is read from stdin (--body-file), so workflow expressions
# and markdown are never interpolated into the gh command line itself.
PR_NUMBER="$1"

if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "::error::post-pr-comment: invalid PR number: $PR_NUMBER"
  exit 1
fi

# No `--` here: gh (cobra/pflag) treats `--` as end-of-flags, which would turn
# --body-file and - into positional args. The numeric check above guarantees
# $PR_NUMBER cannot be flag-like.
gh pr comment "$PR_NUMBER" --body-file -
