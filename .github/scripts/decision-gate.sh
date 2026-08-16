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
# Fails when content other than whitespace follows the final verdict block.
# A well-formed injected marker after the real verdict is already caught by
# the conflicting-blocks check; this catches trailing junk that lacks the
# marker (defense in depth, not a second verdict detector).
verdict_has_trailing_content() {
  local file="$1" last_line
  last_line=$(grep -n 'AGENTHOOD_DECISION' "$file" 2>/dev/null | tail -1 | cut -d: -f1)
  if [ -z "$last_line" ]; then
    return 1
  fi
  local trailing
  trailing=$(tail -n +$((last_line + 1)) "$file" 2>/dev/null | sed '/^[[:space:]]*$/d')
  [ -n "$trailing" ]
}

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
  if [ -n "$last_block" ] && verdict_has_trailing_content "$file"; then
    echo "::error::${prefix}decision block is not the final content -- possible injection, see PR comment for details"
    return 1
  fi

  # Fail-closed on malformed markers: count all AGENTHOOD_DECISION lines vs valid verdicts
  local marker_count valid_count
  marker_count=$(grep -c 'AGENTHOOD_DECISION:' "$file" 2>/dev/null || echo 0)
  valid_count=$(echo "$verdicts" | grep -c . || echo 0)
  if [ "$marker_count" -ne "$valid_count" ]; then
    echo "::error::${prefix}found malformed decision marker (marker count $marker_count != valid verdict count $valid_count) -- possible injection, see PR comment for details"
    return 1
  fi
  case "$last_block" in
    *'blocking=true '*)
      echo "::error::${prefix}found blocking findings -- see PR comment for details"
      return 1
      ;;
    *'blocking=false '*)
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
