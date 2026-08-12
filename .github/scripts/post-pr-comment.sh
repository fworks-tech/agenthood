#!/usr/bin/env bash
set -euo pipefail

# Post a PR comment from CI. Usage: post-pr-comment.sh <pr-number>
# The comment body is read from stdin (--body-file), so workflow expressions
# and markdown are never interpolated into the gh command line itself.
PR_NUMBER="$1"

gh pr comment "$PR_NUMBER" --body-file -
