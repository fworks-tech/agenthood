#!/usr/bin/env bash
set -euo pipefail

# The Warden — enforce the 500-line file size limit on the PR diff.
# Test suites and lockfiles are exempt (test suites routinely exceed 500
# lines; the limit targets source files).

for var in BASE_SHA HEAD_SHA; do
  if [[ -z "${!var:-}" ]]; then
    echo "::error::$var is required"
    exit 1
  fi
  if [[ ! "${!var}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "::error::$var is not a valid 40-hex SHA"
    exit 1
  fi
done

# git diff exits 0 (no changes) or 1 (differences) — anything above 1 is a
# real failure that must not be mistaken for "no files to check"
set +e
CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA"..."$HEAD_SHA" 2>/dev/null)
DIFF_STATUS=$?
set -e
if [ "$DIFF_STATUS" -gt 1 ]; then
  echo "::error::git diff failed (exit $DIFF_STATUS) for $BASE_SHA...$HEAD_SHA — cannot enforce size limits"
  exit 1
fi

failed=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  case "$file" in
    *package-lock.json|*yarn.lock|*pnpm-lock.yaml) continue ;;
    *.test.ts) continue ;;
  esac
  lines=$(wc -l < "$file" | tr -d ' ')
  if [ "$lines" -gt 500 ]; then
    echo "FAIL: $file — $lines lines (limit: 500)"
    failed=1
  elif [ "$lines" -gt 300 ]; then
    echo "WARN: $file — $lines lines (approaching limit of 500)"
  fi
done <<< "$CHANGED"

if [ "$failed" -eq 1 ]; then
  echo ""
  echo "The Warden: one or more files exceed the 500-line limit."
  echo "Split the file or justify the exception in the PR description."
  exit 1
fi
echo "The Warden: all changed files within size limits."
