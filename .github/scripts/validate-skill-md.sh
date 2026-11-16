#!/usr/bin/env bash
set -euo pipefail

failed=0
for dir in docs/members/*/; do
  name=$(basename "$dir")
  [ "$name" = "README.md" ] && continue
  skill="skills/${name#the-}/SKILL.md"
  [ ! -f "$skill" ] && echo "FAIL [$name]: missing SKILL.md" && failed=1 && continue
  fm=$(awk '/^---/{count++; if(count==2) exit} count==1' "$skill")
  if [ -z "$fm" ]; then
    echo "FAIL [$name]: SKILL.md missing or invalid frontmatter (no --- delimiters)" && failed=1 && continue
  fi
  ! echo "$fm" | grep -q "^name:" && echo "FAIL [$name]: SKILL.md missing 'name:'" && failed=1
  ! echo "$fm" | grep -q "^description:" && echo "FAIL [$name]: SKILL.md missing 'description:'" && failed=1
  ! echo "$fm" | grep -q "^license:" && echo "FAIL [$name]: SKILL.md missing 'license:'" && failed=1
done
# Community members (#157): every contrib skill in this repo is listed in the README, and every
# README link into skills/contrib/ resolves to a file with valid frontmatter.
if [ -d skills/contrib ]; then
  for dir in skills/contrib/*/; do
    [ -d "$dir" ] || continue
    skill="${dir}SKILL.md"
    [ ! -f "$skill" ] && echo "FAIL [$dir]: missing SKILL.md" && failed=1 && continue
    grep -q "skills/contrib/$(basename "$dir")/SKILL.md" README.md       || { echo "FAIL [$dir]: not listed in the README Community members table" && failed=1; }
  done
fi

while read -r link; do
  [ -f "$link" ] || { echo "FAIL [$link]: README lists a community member with no SKILL.md" && failed=1; continue; }
  head -n 1 "$link" | grep -q '^---$'     || { echo "FAIL [$link]: missing frontmatter" && failed=1; }
done < <(grep -o 'skills/contrib/[a-z0-9-]*/SKILL.md' README.md | sort -u)

[ "$failed" -eq 1 ] && exit 1
echo "All SKILL.md files have valid frontmatter"
