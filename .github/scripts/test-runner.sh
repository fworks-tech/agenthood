#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_SHA:-}" ] || [ "$BASE_SHA" = "${HEAD_SHA:-}" ]; then
  echo "No PR range available -- running full suite."
  npm exec --no -- vitest run
  exit $?
fi

# git diff exits 0 (no changes) or 1 (differences) — anything above 1 is a
# real failure that must not be mistaken for "no affected tests" (false green)
set +e
CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA"..."$HEAD_SHA" 2>/dev/null)
DIFF_STATUS=$?
set -e
if [ "$DIFF_STATUS" -gt 1 ]; then
  echo "::error::git diff failed (exit $DIFF_STATUS) for $BASE_SHA...$HEAD_SHA — cannot determine affected tests"
  exit 1
fi
CORE_PATTERNS="src/core/ src/llm/ILLMProvider src/llm/types src/members/types src/agents/index src/index"

run_full_suite() {
  npm exec --no -- vitest run
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

find_matching_test() {
  local file="$1" basename found
  basename=$(basename "$file" .ts)
  found=$(find tests -maxdepth 4 -name "${basename}.test.ts" -type f 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    TEST_FILES="$TEST_FILES $found"
  else
    UNMATCHED_SOURCE="$UNMATCHED_SOURCE $file"
  fi
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
      find_matching_test "$FILE"
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

readarray -t SORTED_TESTS < <(echo "$TEST_FILES" | tr ' ' '\n' | sort -u | sed '/^$/d')
echo "Running affected tests: ${SORTED_TESTS[*]}"
npm exec --no -- vitest run -- "${SORTED_TESTS[@]}"
