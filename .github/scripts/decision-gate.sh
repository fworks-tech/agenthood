#!/usr/bin/env bash
# Shared decision-gate check for agent analysis outputs.
# Sourced by .github/scripts/agent-analysis.sh and reviewer.yml.
#
# Injection model: the analysis prompt embeds untrusted material (git diffs),
# so the verdict is only trusted when it is the LAST decision block in the
# output — the agent writes its verdict at the very end, after any injected
# content. Only that final block can trip the gate. If the output contains
# MULTIPLE blocks with different verdicts, an injected block fought the real
# one — fail closed on ambiguity. A missing final block is a warning, never a
# failure, but a present-but-malformed final block fails — a truncated verdict
# must not silently pass. (Residual risk: a successfully prompt-injected agent
# that parrots a single verdict as its own final line — the prompt hardening
# in agent-analysis.sh is the defense in depth for that case.)

# Usage: check_decision_gate <output-file> [agent-name]
# Fails when the last decision block is blocking, when it reports more
# warnings than AGENTHOOD_WARNING_THRESHOLD (default 2), or when the verdict
# blocks disagree with each other.
check_decision_gate() {
  local file="$1" agent_name="${2:-}" prefix="" last_block
  local threshold="${AGENTHOOD_WARNING_THRESHOLD:-2}"
  # coerce an invalid threshold to the default; a non-numeric value would
  # otherwise break the comparison and a huge value would disable the gate
  if ! [[ "$threshold" =~ ^[0-9]+$ ]]; then
    threshold=2
  fi
  [ -n "$agent_name" ] && prefix="$agent_name "
  local verdicts
  verdicts=$(grep -oE '<!--AGENTHOOD_DECISION: blocking=(true|false) warnings=[0-9]+-->' "$file" 2>/dev/null | sed '/^$/d')
  local distinct
  distinct=$(echo "$verdicts" | sort -u | wc -l)
  if [ "$distinct" -gt 1 ]; then
    echo "::error::${prefix}found conflicting decision blocks -- possible injection, see PR comment for details"
    return 1
  fi
  last_block=$(echo "$verdicts" | tail -1)
  case "$last_block" in
    *'blocking=true'*)
      echo "::error::${prefix}found blocking findings -- see PR comment for details"
      return 1
      ;;
    *'blocking=false'*)
      local warnings
      warnings=$(echo "$last_block" | sed -E 's/.*warnings=([0-9]+).*/\1/')
      if [ "$warnings" -gt "$threshold" ]; then
        echo "::error::${prefix}found $warnings warnings (threshold: $threshold) -- see PR comment for details"
        return 1
      fi
      return 0
      ;;
  esac
  if ! grep -q 'AGENTHOOD_DECISION' "$file" 2>/dev/null; then
    echo "::warning::${prefix}output missing a valid trailing decision block -- treated as non-blocking"
    return 0
  fi
  # a decision marker exists but its final block is malformed -- fail
  echo "::error::${prefix}found a malformed trailing decision block -- see PR comment for details"
  return 1
}
