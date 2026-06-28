#!/usr/bin/env bash
set -euo pipefail

FAILED=0
BASE_SHA="$1"
HEAD_SHA="$2"

CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)

check_member_registration() {
  local fail=0
  for FILE in $CHANGED; do
    if echo "$FILE" | grep -qE "^members/the-[a-z-]+/"; then
      NAME=$(echo "$FILE" | sed 's|members/\(the-[a-z-]*\)/.*|\1|')
      if ! grep -q "$NAME" AGENTS.md; then
        echo "FAIL: $NAME added but not registered in AGENTS.md"; fail=1
      fi
      if ! grep -q "$NAME" members/README.md; then
        echo "FAIL: $NAME added but not registered in members/README.md"; fail=1
      fi
      if ! grep -q "$NAME" README.md; then
        echo "FAIL: $NAME added but not registered in README.md"; fail=1
      fi
    fi
  done
  return $fail
}

check_workflow_registration() {
  local fail=0
  for FILE in $CHANGED; do
    if echo "$FILE" | grep -qE "^\.github/workflows/[a-z-]+\.yml"; then
      WORKFLOW=$(basename "$FILE" .yml)
      if ! grep -qF "$WORKFLOW.yml" README.md; then
        echo "FAIL: $WORKFLOW.yml added but not listed in README.md"; fail=1
      fi
    fi
  done
  return $fail
}

check_githooks_registration() {
  local fail=0
  for FILE in $CHANGED; do
    if echo "$FILE" | grep -qE "^\.githooks/"; then
      HOOK=$(basename "$FILE")
      if ! grep -qF "$HOOK" README.md; then
        echo "FAIL: $HOOK added to .githooks/ but not listed in README.md"; fail=1
      fi
    fi
  done
  return $fail
}

check_all_members_indexed() {
  local fail=0
  for MEMBER_DIR in members/*/; do
    NAME=$(basename "$MEMBER_DIR")
    [ "$NAME" = "README.md" ] && continue
    if ! grep -q "$NAME" AGENTS.md; then
      echo "FAIL: $NAME exists in members/ but not in AGENTS.md"; fail=1
    fi
  done
  return $fail
}

check_conventions_sync() {
  local fail=0
  CONVENTIONS_CHANGED=$(echo "$CHANGED" | grep "^conventions/" || true)
  if [ -n "$CONVENTIONS_CHANGED" ]; then
    DOCS_CHANGED=$(echo "$CHANGED" | grep -E "^(AGENTS\.md|README\.md|INITIATION\.md|members/)" || true)
    if [ -z "$DOCS_CHANGED" ]; then
      echo "WARN: conventions/ changed but no doc files updated"
    fi
  fi

  DOCS_DIR_CHANGED=$(echo "$CHANGED" | grep "^docs/" || true)
  if [ -n "$DOCS_DIR_CHANGED" ]; then
    ADR_COUNT=$(find docs/adr -name "*.md" 2>/dev/null | wc -l)
    if [ "$ADR_COUNT" -eq 0 ]; then
      echo "FAIL: docs/ changed but docs/adr/ has no ADRs"; fail=1
    fi
  fi

  COMMANDS_CHANGED=$(echo "$CHANGED" | grep "^src/commands/" || true)
  if [ -n "$COMMANDS_CHANGED" ]; then
    SPEC_UPDATED=$(echo "$CHANGED" | grep -E "^(CONTRIBUTING\.md|CLAUDE\.md)" || true)
    if [ -z "$SPEC_UPDATED" ]; then
      echo "WARN: src/commands/ changed but CONTRIBUTING.md nor CLAUDE.md was updated"
    fi
  fi

  CONVENTIONS_OR_HOOKS=$(echo "$CHANGED" | grep -E "^(conventions/|\.githooks/)" || true)
  if [ -n "$CONVENTIONS_OR_HOOKS" ]; then
    CONTRIBUTING_UPDATED=$(echo "$CHANGED" | grep "^CONTRIBUTING\.md" || true)
    if [ -z "$CONTRIBUTING_UPDATED" ]; then
      echo "WARN: conventions/ or .githooks/ changed but CONTRIBUTING.md was not updated"
    fi
  fi

  CHANGELOG_CHANGED=$(echo "$CHANGED" | grep "^CHANGELOG\.md" || true)
  if [ -n "$CHANGELOG_CHANGED" ]; then
    echo "WARN: CHANGELOG.md modified manually — it is managed by semantic-release"
  fi

  return $fail
}

check_member_registration || FAILED=1
check_workflow_registration || FAILED=1
check_githooks_registration || FAILED=1
check_all_members_indexed || FAILED=1
check_conventions_sync || FAILED=1

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "The Librarian: one or more documentation checks failed."
  echo "Update the relevant documentation files to match code changes."
  exit 1
fi
echo "The Librarian: documentation is consistent with the changes."
