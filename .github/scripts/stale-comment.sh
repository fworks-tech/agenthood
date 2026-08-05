#!/usr/bin/env bash
# Shared stale-comment marking for agent analyses.
# Sourced by .github/scripts/agent-analysis.sh and reviewer.yml.

# Usage: mark_previous_comment_outdated <jq-query> <pr-number> <temp-dir>
# The jq query selects comment IDs (e.g. by header or decision marker).
mark_previous_comment_outdated() {
  local query="$1" pr_number="$2" temp_dir="$3"
  local comment_id body_file payload_file
  comment_id=$(gh api "repos/{owner}/{repo}/issues/$pr_number/comments" --jq "$query" 2>/dev/null | tail -1 || true)
  [ -z "$comment_id" ] && return 0
  body_file="${temp_dir}/stale_body.txt"
  payload_file="${temp_dir}/stale_payload.json"
  gh api "repos/{owner}/{repo}/issues/comments/$comment_id" --jq -r '.body' > "$body_file" 2>/dev/null || return 0
  { echo "> **This analysis is outdated.** See the latest comment below for the current review."; echo ">"; cat "$body_file"; } | jq -Rs '{body: .}' > "$payload_file"
  gh api "repos/{owner}/{repo}/issues/comments/$comment_id" -X PATCH --input "$payload_file" > /dev/null 2>&1 || true
}
