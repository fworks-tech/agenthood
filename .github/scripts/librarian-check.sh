#!/usr/bin/env bash
set -euo pipefail

FAILED=0
CHANGED=$(git diff --name-only --diff-filter=ACM "${BASE_SHA:?}" "${HEAD_SHA:?}" 2>/dev/null)

# Check a changed-file pattern is registered in a registry file
check_registered() {
  local pattern="$1" extract="$2" registry="$3" label="$4"
  local fail=0
  while IFS= read -r FILE; do
    if echo "$FILE" | grep -qE "$pattern"; then
      NAME=$(echo "$FILE" | sed "$extract")
      if ! grep -qF "$NAME" "$registry"; then
        echo "FAIL: $label '$NAME' not registered in $registry"; fail=1
      fi
    fi
  done < <(echo "$CHANGED")
  return $fail
}

check_member_registration() {
  local fail=0
  while IFS= read -r FILE; do
    if echo "$FILE" | grep -qE "^members/the-[a-z-]+/"; then
      NAME=$(echo "$FILE" | sed 's|members/\(the-[a-z-]*\)/.*|\1|')
      if ! grep -q "$NAME" AGENTS.md; then
        echo "FAIL: $NAME added but not registered in AGENTS.md"; fail=1
      fi
      if ! grep -q "$NAME" members/README.md; then
        echo "FAIL: $NAME added but not registered in members/README.md"; fail=1
      fi
      if ! grep -q "$NAME" STRUCTURE.md; then
        echo "FAIL: $NAME added but not registered in STRUCTURE.md"; fail=1
      fi
    fi
  done < <(echo "$CHANGED")
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

check_conventions_docs_sync() {
  local conventions_changed docs_changed
  conventions_changed=$(echo "$CHANGED" | grep "^conventions/" || true)
  [ -z "$conventions_changed" ] && return 0
  docs_changed=$(echo "$CHANGED" | grep -E "^(AGENTS\.md|README\.md|INITIATION\.md|members/)" || true)
  [ -z "$docs_changed" ] && echo "WARN: conventions/ changed but no doc files updated"
}

check_docs_adr_sync() {
  local docs_dir_changed adr_count
  docs_dir_changed=$(echo "$CHANGED" | grep "^docs/" || true)
  [ -z "$docs_dir_changed" ] && return 0
  adr_count=$(find docs/adr -name "*.md" 2>/dev/null | wc -l)
  [ "$adr_count" -eq 0 ] && echo "FAIL: docs/ changed but docs/adr/ has no ADRs" && return 1
}

check_commands_spec_sync() {
  local commands_changed spec_updated
  commands_changed=$(echo "$CHANGED" | grep "^src/commands/" || true)
  [ -z "$commands_changed" ] && return 0
  spec_updated=$(echo "$CHANGED" | grep -E "^(CONTRIBUTING\.md|CLAUDE\.md)" || true)
  [ -z "$spec_updated" ] && echo "WARN: src/commands/ changed but CONTRIBUTING.md nor CLAUDE.md was updated"
}

check_hooks_contributing_sync() {
  local conventions_or_hooks contributing_updated
  conventions_or_hooks=$(echo "$CHANGED" | grep -E "^(conventions/|\.githooks/)" || true)
  [ -z "$conventions_or_hooks" ] && return 0
  contributing_updated=$(echo "$CHANGED" | grep "^CONTRIBUTING\.md" || true)
  [ -z "$contributing_updated" ] && echo "WARN: conventions/ or .githooks/ changed but CONTRIBUTING.md was not updated"
}

check_changelog_disclaimer() {
  local changelog_changed
  changelog_changed=$(echo "$CHANGED" | grep "^CHANGELOG\.md" || true)
  [ -z "$changelog_changed" ] && return 0
  echo "WARN: CHANGELOG.md modified manually -- it is managed by semantic-release"
}

check_member_registration || FAILED=1
check_registered '^\.github/workflows/[a-z-]+\.yml' 's|\.github/workflows/\(.*\)|\1|' STRUCTURE.md "workflow" || FAILED=1
check_registered '^\.githooks/' 's|\.githooks/\(.*\)|\1|' STRUCTURE.md "hook" || FAILED=1
check_all_members_indexed || FAILED=1
check_conventions_docs_sync || FAILED=1
check_docs_adr_sync || FAILED=1
check_commands_spec_sync || FAILED=1
check_hooks_contributing_sync || FAILED=1
check_changelog_disclaimer

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "The Librarian: one or more documentation checks failed."
  echo "Update the relevant documentation files to match code changes."
  exit 1
fi
echo "The Librarian: documentation is consistent with the changes."
