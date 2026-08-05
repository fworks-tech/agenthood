#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/decision-gate.sh"
source "$(dirname "$0")/stale-comment.sh"

RANGE="${RANGE:-}"
if [ -z "$RANGE" ]; then
  echo "::error::RANGE env var required (format: base...head)"
  exit 1
fi
BASE_SHA="${RANGE%%...*}"
HEAD_SHA="${RANGE#*...}"
[ -z "$HEAD_SHA" ] && HEAD_SHA="$BASE_SHA"

temp_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/agent-analysis.XXXXXX")"
trap 'rm -rf "$temp_dir"' EXIT
analysis_file="${temp_dir}/${AGENT_NAME}_analysis.txt"
error_file="${temp_dir}/${AGENT_NAME}_errors.txt"
body_file="${temp_dir}/${AGENT_NAME}_body.md"
NAME_DISPLAY=$(echo "$AGENT_NAME" | sed 's/-/ /g; s/\b\(.\)/\u\1/g')
> "$error_file"

validate_prerequisites() {
  if [ -z "$OPENCODE_API_KEY" ]; then
    echo "::notice::OPENCODE_API_KEY not set -- skipping $AGENT_NAME agent analysis."
    exit 0
  fi

  if [ -z "$PR_NUMBER" ]; then
    echo "::notice::No pull request context -- skipping $AGENT_NAME agent analysis."
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
  mark_previous_comment_outdated ".[] | select(.body | startswith(\"## $NAME_DISPLAY -- Analysis\")) | .id" "$PR_NUMBER" "$temp_dir"
}

build_comment_body() {
  {
    echo "## $NAME_DISPLAY -- Analysis"
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

validate_prerequisites
SAFE_CHANGED=$(cat ${temp_dir}/${AGENT_NAME}_safe_changed.txt)
echo "agent-analysis: running $AGENT_NAME on $(echo "$SAFE_CHANGED" | tr '\n' ' ')"

npm ci --ignore-scripts
npm run build

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

if ! check_decision_gate "$analysis_file" "$AGENT_NAME"; then
  exit 1
fi
