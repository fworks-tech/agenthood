#!/usr/bin/env bash
set -euo pipefail

FAILED=0
REQUIRED_SECTIONS="## Overview ## When to Use ## Process ## Red Flags ## Rationalizations ## Verification"
INDEXES="AGENTS.md members/README.md README.md"

check_readme_presence() {
  local fail=0
  for dir in members/*/; do
    name=$(basename "$dir")
    [ "$name" = "README.md" ] && continue
    [ ! -f "${dir}README.md" ] && echo "FAIL [$name]: missing README.md" && fail=1
  done
  [ "$fail" -eq 1 ] && return 1
  echo "All members have README.md"
}

check_skill_sections() {
  local fail=0
  for dir in members/*/; do
    name=$(basename "$dir")
    [ "$name" = "README.md" ] && continue
    skill="${dir}SKILL.md"
    [ ! -f "$skill" ] && continue
    for section in $REQUIRED_SECTIONS; do
      ! grep -qF "$section" "$skill" && echo "FAIL [$name]: SKILL.md missing '$section'" && fail=1
    done
  done
  [ "$fail" -eq 1 ] && return 1
  echo "All SKILL.md files have required sections"
}

check_registration() {
  local fail=0
  for dir in members/*/; do
    name=$(basename "$dir")
    [ "$name" = "README.md" ] && continue
    for idx in $INDEXES; do
      ! grep -q "$name" "$idx" && echo "FAIL [$name]: not registered in $idx" && fail=1
    done
  done
  [ "$fail" -eq 1 ] && return 1
  echo "All members registered in all index files"
}

check_skills_sync() {
  local fail=0
  for dir in members/*/; do
    name=$(basename "$dir")
    [ "$name" = "README.md" ] && continue
    member_file="members/$name/SKILL.md"
    skill_file="skills/$name/SKILL.md"
    if [ ! -f "$skill_file" ]; then
      echo "FAIL [$name]: missing $skill_file"; fail=1
    elif ! cmp -s "$member_file" "$skill_file"; then
      echo "FAIL [$name]: $skill_file differs from $member_file"; fail=1
    fi
  done
  [ "$fail" -eq 1 ] && return 1
  echo "All skills/ files match members/ content."
}

check_no_orphan_skills() {
  local fail=0
  for dir in skills/*/; do
    name=$(basename "$dir")
    [ ! -d "members/$name" ] && echo "FAIL [skills/$name]: orphan directory" && fail=1
  done
  [ "$fail" -eq 1 ] && return 1
  echo "No orphan skills/ directories."
}

check_readme_presence || FAILED=1
.github/scripts/validate-skill-md.sh || FAILED=1
check_skill_sections || FAILED=1
check_registration || FAILED=1
check_skills_sync || FAILED=1
check_no_orphan_skills || FAILED=1

[ "$FAILED" -eq 1 ] && exit 1
echo "The Sentinel: all member structure checks passed."
