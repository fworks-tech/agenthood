#!/usr/bin/env bash
# Collects the measurements each ritual needs, so the member never needs a
# shell: the runtime has no shell tool, and a model asked to run git in a
# tool-less session either stalls or refuses (the runner exits 2). The
# workflow shell runs this, then passes the output to the member as the
# task's "Measured facts". Usage: ritual-facts.sh <ritual-name>.
set -uo pipefail

ritual="${1:?usage: ritual-facts.sh <ritual-name>}"
git fetch origin --quiet 2>/dev/null || true
NOW=$(date +%s)

case "$ritual" in
  watchman)
    echo "### Idle uncommitted files (threshold: 2 hours)"
    dirty=$(git status --porcelain -uall | cut -c4-)
    if [ -z "$dirty" ]; then
      echo "none: the worktree is clean"
    else
      while IFS= read -r f; do
        [ -f "$f" ] || { echo "$f: not a regular file, skipped"; continue; }
        h=$(( (NOW - $(stat -c %Y "$f")) / 3600 ))
        echo "$f: last modified $h hours ago"
      done <<< "$dirty"
    fi
    echo ""
    echo "### Branches more than 20 commits behind main"
    found=0
    while IFS= read -r b; do
      case "$b" in origin/main|origin/HEAD) continue ;; esac
      n=$(git rev-list --count "$b..origin/main" 2>/dev/null || echo 0)
      if [ "$n" -gt 20 ]; then echo "$b: $n commits behind main"; found=1; fi
    done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)
    [ "$found" -eq 0 ] && echo "none: every branch is within 20 commits of main"
    ;;
  morning-briefing)
    echo "### Merged PRs, last 24 hours"
    gh pr list --state merged --limit 30 --json number,title,mergedAt \
      --jq '.[] | "#\(.number) \(.title) (merged \(.mergedAt))"' 2>/dev/null || echo "unavailable"
    echo ""
    echo "### Open PRs by age"
    gh pr list --state open --limit 30 --json number,title,author,createdAt \
      --jq 'sort_by(.createdAt) | .[] | "#\(.number) \(.title) by \(.author.login), opened \(.createdAt)"' 2>/dev/null || echo "unavailable"
    echo ""
    echo "### Branches with commits in the last 24 hours"
    branch_found=0
    while IFS= read -r b; do
      case "$b" in origin/main|origin/HEAD) continue ;; esac
      c=$(git rev-list --count "$b" --since="24 hours ago" 2>/dev/null || echo 0)
      if [ "$c" -gt 0 ]; then
        echo "$b: $c commits, last activity $(git log -1 --format='%ar' "$b" 2>/dev/null || echo unknown)"
        branch_found=1
      fi
    done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)
    [ "$branch_found" -eq 0 ] && echo "none in the last 24 hours"
    ;;
  inspection)
    echo "### TODO and FIXME comments (file:line)"
    grep -rnE '(TODO|FIXME)' src/ --include='*.ts' 2>/dev/null | head -30 || echo "none"
    echo ""
    echo "### Source files over 500 lines"
    over=$(find src -name '*.ts' -exec wc -l {} + 2>/dev/null | awk '$1 > 500 && $2 != "total" {print $2": "$1" lines"}' | head -20)
    echo "${over:-none}"
    echo ""
    echo "### Wildcard dependency versions in package.json"
    wild=$(grep -nE '"[^"]+":\s*"[^"]*[*x]' package.json | head -10)
    echo "${wild:-none}"
    echo ""
    echo "### Source files without a same-named test file (first 20)"
    untested=0
    while IFS= read -r f; do
      b=$(basename "$f" .ts)
      git ls-files "tests/**/$b.test.ts" | grep -q . || { echo "$f"; untested=1; }
    done < <(git ls-files 'src/**/*.ts' | grep -v '\.test\.ts$')
    [ "$untested" -eq 0 ] && echo "none"
    ;;
  evening-report)
    echo "### Commits on main since 08:00 local today"
    commits=$(git log origin/main --since="08:00" --oneline --no-merges | head -30)
    echo "${commits:-none yet}"
    echo ""
    echo "### Merged PRs (latest 30, filter to today when formatting)"
    gh pr list --state merged --limit 30 --json number,title,mergedAt \
      --jq '.[] | "#\(.number) \(.title) (merged \(.mergedAt))"' 2>/dev/null || echo "unavailable"
    echo ""
    echo "### Issues closed (latest 30, filter to today when formatting)"
    gh issue list --state closed --limit 30 --json number,title,closedAt \
      --jq '.[] | "#\(.number) \(.title) (closed \(.closedAt))"' 2>/dev/null || echo "unavailable"
    echo ""
    echo "### Branches with commits today (cross with open PRs below)"
    branch_found=0
    while IFS= read -r b; do
      case "$b" in origin/main|origin/HEAD) continue ;; esac
      c=$(git rev-list --count "$b" --since="today 00:00" 2>/dev/null || echo 0)
      if [ "$c" -gt 0 ]; then echo "$b: $c commits today"; branch_found=1; fi
    done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)
    [ "$branch_found" -eq 0 ] && echo "none today"
    echo ""
    echo "### Open PRs (head branches, to cross with the list above)"
    gh pr list --state open --limit 30 --json number,headRefName \
      --jq '.[] | "#\(.number) head: \(.headRefName)"' 2>/dev/null || echo "unavailable"
    ;;
  *)
    echo "unknown ritual: $ritual" >&2
    exit 1
    ;;
esac
# Findings are data, not failure: the caller only treats a non-zero exit as
# a broken collection.
exit 0
