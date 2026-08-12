#!/usr/bin/env bash
# Shared decision-gate check for agent analysis outputs.
# Sourced by .github/scripts/agent-analysis.sh and reviewer.yml.
#
# Injection model: the analysis prompt embeds untrusted material (git diffs),
# so the verdict is only trusted when it is the LAST decision block in the
# output — the agent writes its verdict at the very end, after any injected
# content. Only that final block can trip the gate; earlier injected blocks
# are ignored, and a missing/malformed final block is a warning, never a
# failure. (Residual risk: a successfully prompt-injected agent that parrots
# an injected verdict as its own final line — the prompt hardening in
# agent-analysis.sh is the defense in depth for that case.)

# Usage: check_decision_gate <output-file> [agent-name]
# Fails only when the last decision block is exactly
# <!--AGENTHOOD_DECISION: blocking=true warnings=N-->.
check_decision_gate() {
  local file="$1" agent_name="${2:-}" prefix="" last_block
  [ -n "$agent_name" ] && prefix="$agent_name "
  last_block=$(grep -oE '<!--AGENTHOOD_DECISION: blocking=(true|false) warnings=[0-9]+-->' "$file" 2>/dev/null | tail -1)
  case "$last_block" in
    *'blocking=true'*)
      echo "::error::${prefix}found blocking findings -- see PR comment for details"
      return 1
      ;;
    *'blocking=false'*)
      return 0
      ;;
    *)
      echo "::warning::${prefix}output missing a valid trailing decision block -- treated as non-blocking"
      return 0
      ;;
  esac
}
