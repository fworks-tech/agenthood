#!/usr/bin/env bash
set -euo pipefail

# The Warden — enforce the 500-line file size limit on the PR diff.
# Test suites and lockfiles are exempt (test suites routinely exceed 500
# lines; the limit targets source files).
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
done < <(git diff --name-only --diff-filter=ACM "$BASE_SHA"..."$HEAD_SHA" 2>/dev/null)

if [ "$failed" -eq 1 ]; then
  echo ""
  echo "The Warden: one or more files exceed the 500-line limit."
  echo "Split the file or justify the exception in the PR description."
  exit 1
fi
echo "The Warden: all changed files within size limits."
