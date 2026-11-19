#!/usr/bin/env bash
# Retire a gate-report PR comment once the gate that posted it passes.
# Agent analyses mark their own history through stale-comment.sh; deterministic
# gate reports (Librarian doc sync, Auditor secret scan) had no resolver, so a
# warning posted on a failing head survived every green push as a zombie.
# Usage: resolve-pr-comment.sh <pr-number> <member header>
# Exits 0 without touching anything when no matching comment exists.
set -euo pipefail

source "$(dirname "$0")/stale-comment.sh"

PR_NUMBER="$1"
HEADER="$2"

if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "::error::resolve-pr-comment: invalid PR number: $PR_NUMBER"
  exit 1
fi

# startswith is enough: the resolved body begins with a quote block, so a
# second green run matches nothing and the script stays idempotent.
query="[.[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"$HEADER\"))) | .id] | last // \"\""
comment_id=$(gh api "repos/{owner}/{repo}/issues/$PR_NUMBER/comments?per_page=100" --paginate --jq "$query" 2>/dev/null | tail -1 || true)
[ -z "$comment_id" ] && { echo "resolve-pr-comment: no open '$HEADER' comment to resolve"; exit 0; }

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

original=$(mktemp "$temp_dir/original.XXXXXX")
payload=$(mktemp "$temp_dir/payload.XXXXXX")
gh api "repos/{owner}/{repo}/issues/comments/$comment_id" -q '.body' > "$original" || exit 0

{
  echo "> **Resolved.** The $HEADER gate passes on the current head (run ${GH_RUN_ID:-unknown}). The original warning follows."
  echo ">"
  cat "$original"
} | jq -Rs '{body: .}' > "$payload"

gh api "repos/{owner}/{repo}/issues/comments/$comment_id" -X PATCH --input "$payload" > /dev/null
echo "resolve-pr-comment: retired comment $comment_id for '$HEADER'"
