#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_SHA:-}" ] || [ "$BASE_SHA" = "${HEAD_SHA:-}" ]; then
  echo "No PR range available -- running full suite."
  npx vitest run --exclude 'vscode-extension/**'
  exit $?
fi

CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)
FULL_SUITE=false

if echo "$CHANGED" | grep -qE '^(package\.json|package-lock\.json|tsconfig\.json|vitest\.config)'; then
  echo "Critical config changed -- running full suite."
  FULL_SUITE=true
fi

CORE_PATTERNS="src/core/ src/llm/ILLMProvider src/llm/types src/members/types src/agents/index src/index"

TEST_FILES=""
UNMATCHED_SOURCE=""

while IFS= read -r FILE; do
  case "$FILE" in
    *[!a-zA-Z0-9_./-]*)
      echo >&2 "Skipping file with unsafe name: $FILE"
      continue ;;
  esac
  case "$FILE" in
    *.test.ts)
      TEST_FILES="$TEST_FILES $FILE"
      ;;
    *.ts)
      while IFS= read -r CP; do
        [ -z "$CP" ] && continue
        if echo "$FILE" | grep -qE "^${CP}"; then
          echo "Shared module changed ($FILE) -- running full suite."
          FULL_SUITE=true
          break
        fi
      done < <(echo "$CORE_PATTERNS" | tr ' ' '\n')
      if [ "$FULL_SUITE" = true ]; then
        break
      fi
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

if [ "$FULL_SUITE" = true ]; then
  npx vitest run --exclude 'vscode-extension/**'
  exit $?
fi

if [ -n "$UNMATCHED_SOURCE" ]; then
  echo "::warning::Source files changed without matching tests:$UNMATCHED_SOURCE -- running full suite."
  npx vitest run --exclude 'vscode-extension/**'
  exit $?
fi

if [ -z "$TEST_FILES" ]; then
  echo "No affected tests -- only docs, workflows, or config changed. Skipping."
  echo "Changed: $CHANGED"
  exit 0
fi

SORTED_TESTS=$(echo "$TEST_FILES" | tr ' ' '\n' | sort -u | tr '\n' ' ')
echo "Running affected tests: $SORTED_TESTS"
npx vitest run --exclude 'vscode-extension/**' $SORTED_TESTS
