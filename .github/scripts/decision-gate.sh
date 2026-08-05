#!/usr/bin/env bash
# Shared decision-gate check for agent analysis outputs.
# Sourced by .github/scripts/agent-analysis.sh and reviewer.yml.

# Usage: check_decision_gate <output-file> [agent-name]
# Fails when the AGENTHOOD_DECISION block is missing, malformed, or blocking=true.
check_decision_gate() {
  local file="$1" agent_name="${2:-}" prefix=""
  [ -n "$agent_name" ] && prefix="$agent_name "
  if grep -qE '<!--AGENTHOOD_DECISION: blocking=(true|false) warnings=[0-9]+-->' "$file" 2>/dev/null; then
    if grep -qE '<!--AGENTHOOD_DECISION:.*blocking=true.*-->' "$file" 2>/dev/null; then
      echo "::error::${prefix}found blocking findings -- see PR comment for details"
      return 1
    fi
    return 0
  else
    echo "::error::${prefix}output missing structured decision block (expected: blocking=true|false warnings=N)"
    return 1
  fi
}
