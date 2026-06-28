#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_SHA:-}" ] || [ "$BASE_SHA" = "${HEAD_SHA:-}" ]; then
  echo "No PR range available -- running full suite."
  npx vitest run --exclude 'vscode-extension/**'
  exit $?
fi

CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)
CORE_PATTERNS="src/core/ src/llm/ILLMProvider src/llm/types src/members/types src/agents/index src/index"

run_full_suite() {
  npx vitest run --exclude 'vscode-extension/**'
  exit $?
}

check_full_suite_trigger() {
  local file="$1"
  case "$file" in
    package.json|package-lock.json|tsconfig.json|vitest.config*) return 0 ;;
  esac
  case "$file" in
    *.ts)
      local cp
      while IFS= read -r cp; do
        [ -z "$cp" ] && continue
        if echo "$file" | grep -qE "^${cp}"; then return 0; fi
      done < <(echo "$CORE_PATTERNS" | tr ' ' '\n')
      ;;
  esac
  return 1
}

TEST_FILES=""
UNMATCHED_SOURCE=""

while IFS= read -r FILE; do
  case "$FILE" in
    *[!a-zA-Z0-9_./-]*)
      echo >&2 "Skipping file with unsafe name: $FILE"
      continue ;;
  esac
  if check_full_suite_trigger "$FILE"; then
    echo "Full suite trigger ($FILE) -- running all tests."
    run_full_suite
  fi
  case "$FILE" in
    *.test.ts)
      TEST_FILES="$TEST_FILES $FILE"
      ;;
    *.ts)
      BASENAME=$(basename "$FILE" .ts)
      FOUND=$(find tests -maxdepth 4 -name "${BASENAME}.test.ts" -type f 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        TEST_FILES="$TEST_FILES $FOUND"
      else
        UNMATCHED_SOURCE="$UNMATCHED_SOURCE $FILE"
      fi
      ;;
  esac
done < <(echo "$CHANGED")

if [ -n "$UNMATCHED_SOURCE" ]; then
  echo "::warning::Source files changed without matching tests:$UNMATCHED_SOURCE -- running full suite."
  run_full_suite
fi

if [ -z "$TEST_FILES" ]; then
  echo "No affected tests -- only docs, workflows, or config changed. Skipping."
  echo "Changed: $CHANGED"
  exit 0
fi

SORTED_TESTS=$(echo "$TEST_FILES" | tr ' ' '\n' | sort -u | tr '\n' ' ')
echo "Running affected tests: $SORTED_TESTS"
npx vitest run --exclude 'vscode-extension/**' $SORTED_TESTS
