#!/usr/bin/env bash
set -euo pipefail

FAILED=0
REQUIRED_SECTIONS=("## Overview" "## When to Use" "## Process" "## Red Flags" "## Rationalizations" "## Verification")
INDEXES="AGENTS.md members/README.md README.md"

check_readme_for_member() {
  local name="$1" dir="$2"
  [ ! -f "${dir}README.md" ] && echo "FAIL [$name]: missing README.md" && return 1
  return 0
}

check_sections_for_member() {
  local name="$1" dir="$2" section fail=0
  local skill="${dir}SKILL.md"
  [ ! -f "$skill" ] && return 0
  for section in "${REQUIRED_SECTIONS[@]}"; do
    ! grep -qF "$section" "$skill" && echo "FAIL [$name]: SKILL.md missing '$section'" && fail=1
  done
  return $fail
}

check_registration_for_member() {
  local name="$1" idx fail=0
  for idx in $INDEXES; do
    ! grep -q "$name" "$idx" && echo "FAIL [$name]: not registered in $idx" && fail=1
  done
  return $fail
}

check_sync_for_member() {
  local name="$1"
  local member_file="members/$name/SKILL.md"
  local skill_file="skills/$name/SKILL.md"
  if [ ! -f "$skill_file" ]; then
    echo "FAIL [$name]: missing $skill_file"; return 1
  elif ! cmp -s "$member_file" "$skill_file"; then
    echo "FAIL [$name]: $skill_file differs from $member_file"; return 1
  fi
}

check_no_orphan_skills() {
  local fail=0 name
  for dir in skills/*/; do
    name=$(basename "$dir")
    [ ! -d "members/$name" ] && echo "FAIL [skills/$name]: orphan directory" && fail=1
  done
  [ "$fail" -eq 1 ] && return 1
  echo "No orphan skills/ directories."
}

for dir in members/*/; do
  name=$(basename "$dir")
  [ "$name" = "README.md" ] && continue
  check_readme_for_member "$name" "$dir" || FAILED=1
  check_sections_for_member "$name" "$dir" || FAILED=1
  check_registration_for_member "$name" "$dir" || FAILED=1
  check_sync_for_member "$name" "$dir" || FAILED=1
done

.github/scripts/validate-skill-md.sh || FAILED=1
check_no_orphan_skills || FAILED=1

[ "$FAILED" -eq 1 ] && exit 1
echo "The Sentinel: all member structure checks passed."
