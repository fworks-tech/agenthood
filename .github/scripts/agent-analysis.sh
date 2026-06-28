#!/usr/bin/env bash
set -euo pipefail
set -x

BASE_SHA="${RANGE%%...*}"
HEAD_SHA="${RANGE#*...}"
[ -z "$HEAD_SHA" ] && HEAD_SHA="$BASE_SHA"

temp_dir="${RUNNER_TEMP:-/tmp}"
analysis_file="${temp_dir}/${AGENT_NAME}_analysis.txt"
error_file="${temp_dir}/${AGENT_NAME}_errors.txt"
body_file="${temp_dir}/${AGENT_NAME}_body.md"
> "$error_file"

validate_prerequisites() {
  if [ -z "$OPENCODE_API_KEY" ]; then
    echo "::notice::OPENCODE_API_KEY not set -- skipping $AGENT_NAME agent analysis."
    exit 0
  fi

  CHANGED=$(git diff --name-only --diff-filter=ACM "$BASE_SHA" "$HEAD_SHA" 2>/dev/null || echo "")
  if [ -z "$CHANGED" ]; then
    echo "No files changed. Skipping agent analysis."
    exit 0
  fi

  MAX_FILES="${MAX_FILES:-15}"
  CHANGED=$(echo "$CHANGED" | head -"$MAX_FILES")

  SAFE_CHANGED=$(echo "$CHANGED" | grep -v '[^-_./a-zA-Z0-9]' || true)
  if [ -z "$SAFE_CHANGED" ]; then
    echo "::warning::All changed file names contain special characters -- skipping agent analysis."
    exit 0
  fi

  if [[ "$PROMPT_TEMPLATE" != *%s* ]]; then
    echo "::error::prompt-template must contain %s placeholder"
    exit 1
  fi
  TASK="${PROMPT_TEMPLATE//%s/$SAFE_CHANGED}"
  echo "$SAFE_CHANGED" > ${temp_dir}/${AGENT_NAME}_safe_changed.txt
}

stale_previous_comment() {
  local name_display comment_id
  name_display=$(echo "$AGENT_NAME" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
  comment_id=$(gh api "repos/{owner}/{repo}/issues/$PR_NUMBER/comments" --jq --arg name "$name_display" '.[] | select(.body | startswith("## " + $name + " -- Analysis")) | .id' 2>/dev/null | tail -1)
  [ -z "$comment_id" ] && return 0
  gh api "repos/{owner}/{repo}/issues/comments/$comment_id" --jq -r '.body' > ${temp_dir}/${AGENT_NAME}_stale_body.txt 2>/dev/null || return 0
  { echo "> **This analysis is outdated.** See the latest comment below for the current review."; echo ">"; cat ${temp_dir}/${AGENT_NAME}_stale_body.txt; } | jq -Rs '{body: .}' > ${temp_dir}/${AGENT_NAME}_stale_payload.json
  gh api "repos/{owner}/{repo}/issues/comments/$comment_id" -X PATCH --input ${temp_dir}/${AGENT_NAME}_stale_payload.json > /dev/null 2>&1 || true
}

build_comment_body() {
  local name_display
  name_display=$(echo "$AGENT_NAME" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
  {
    echo "## $name_display -- Analysis"
    echo ""

    if [ -s "$error_file" ]; then
      echo "> **Note:** The analysis encountered issues:"
      echo ">"
      grep -v -iE '(api[_-]?key|token|secret|password|credential|bearer|pat|jwt)' "$error_file" | sed 's/^/> /' || true
      echo ""
    fi

    if [ -s "$analysis_file" ]; then
      grep -v "^Error running\|^Using \|^opencode-go\|^groq\|^ollama\|^All providers\|^$" "$analysis_file" | grep -v -iE '(api[_-]?key|token|secret|password|credential|bearer|pat|jwt)' || true
    fi

    if [ ! -s "$analysis_file" ] && [ ! -s "$error_file" ]; then
      echo "*No analysis output produced.*"
    elif [ ! -s "$analysis_file" ] && [ -s "$error_file" ]; then
      echo ""
      echo "*Agent analysis failed. Review the error details above.*"
    fi
  } > "$body_file"
}

check_agenthood_decision() {
  if grep -qE '<!--AGENTHOOD_DECISION:' "$analysis_file" 2>/dev/null; then
    if grep -qE '<!--AGENTHOOD_DECISION:.*blocking=true' "$analysis_file" 2>/dev/null; then
      echo "::error::${AGENT_NAME} found blocking findings -- see PR comment for details"
      return 1
    fi
    return 0
  else
    echo "::warning::${AGENT_NAME} output missing structured decision block -- see comment for manual review"
  fi
}

validate_prerequisites
SAFE_CHANGED=$(cat ${temp_dir}/${AGENT_NAME}_safe_changed.txt)
echo "agent-analysis: running $AGENT_NAME on $(echo "$SAFE_CHANGED" | tr '\n' ' ')"

npm ci && npm run build

rc=0
node dist/cli.js run "$AGENT_NAME" "$TASK" --provider opencode-go \
  1> "$analysis_file" \
  2>> "$error_file" || rc=$?

build_comment_body

if [ -s "$body_file" ]; then
  stale_previous_comment
  gh pr comment "$PR_NUMBER" --body-file "$body_file"
fi

if [ "$rc" -ne 0 ]; then
  echo "::warning::${AGENT_NAME} CLI exited with code $rc -- analysis may be incomplete"
fi

if ! check_agenthood_decision; then
  exit 1
fi
