#!/usr/bin/env bash
set -euo pipefail

failed=0
for dir in members/*/; do
  name=$(basename "$dir")
  [ "$name" = "README.md" ] && continue
  skill="${dir}SKILL.md"
  [ ! -f "$skill" ] && echo "FAIL [$name]: missing SKILL.md" && failed=1 && continue
  fm=$(awk '/^---/{count++; if(count==2) exit} count==1' "$skill")
  ! echo "$fm" | grep -q "^name:" && echo "FAIL [$name]: SKILL.md missing 'name:'" && failed=1
  ! echo "$fm" | grep -q "^description:" && echo "FAIL [$name]: SKILL.md missing 'description:'" && failed=1
  ! echo "$fm" | grep -q "^license:" && echo "FAIL [$name]: SKILL.md missing 'license:'" && failed=1
done
[ "$failed" -eq 1 ] && exit 1
echo "All SKILL.md files have valid frontmatter"
