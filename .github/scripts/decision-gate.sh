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
  last_line=$(grep -n '^<!--AGENTHOOD_DECISION' "$file" 2>/dev/null | tail -1 | cut -d: -f1)
  if [ -z "$last_line" ]; then
    return 1
  fi
  local trailing
  trailing=$(tail -n +$((last_line + 1)) "$file" 2>/dev/null | sed '/^[[:space:]]*$/d')
  [ -n "$trailing" ]
}

# Extract valid verdict lines. Markers must start a line — a quoted
# `AGENTHOOD_DECISION:` inside review prose is data, not a verdict.
verdicts_for() {
  grep -oE '^<!--AGENTHOOD_DECISION: blocking=(true|false) warnings=[0-9]+-->' "$1" 2>/dev/null | sed '/^$/d'
}

has_conflicting_blocks() {
  [ "$(echo "$1" | sed '/^$/d' | sort -u | wc -l)" -gt 1 ]
}

# Fail-closed on malformed markers: any decision-marker line that is not a
# valid verdict means a truncated or injected block. grep -c always prints a
# count (0 on no match), so a `|| echo 0` fallback would double-print and
# break the integer comparison -- never add one.
has_malformed_markers() {
  local marker_count valid_count
  marker_count=$(grep -c '^<!--AGENTHOOD_DECISION:' "$1" 2>/dev/null)
  valid_count=$(echo "$2" | grep -c .)
  [ "$marker_count" -ne "$valid_count" ]
}

# The final verdict block; empty when the output has no valid verdict.
last_verdict() {
  echo "$1" | tail -1
}

check_decision_gate() {
  local file="$1" agent_name="${2:-}" prefix="" verdicts last_block
  local threshold="${AGENTHOOD_WARNING_THRESHOLD:-2}"
  # coerce an invalid threshold to the default; a non-numeric value would
  # otherwise break the comparison and a huge value would disable the gate
  if ! [[ "$threshold" =~ ^[0-9]+$ ]]; then
    threshold=2
  fi
  [ -n "$agent_name" ] && prefix="$agent_name "

  verdicts=$(verdicts_for "$file")
  if has_conflicting_blocks "$verdicts"; then
    echo "::error::${prefix}found conflicting decision blocks -- possible injection, see PR comment for details"
    return 1
  fi
  if [ -n "$verdicts" ] && verdict_has_trailing_content "$file"; then
    echo "::error::${prefix}decision block is not the final content -- possible injection, see PR comment for details"
    return 1
  fi
  if has_malformed_markers "$file" "$verdicts"; then
    echo "::error::${prefix}found malformed decision marker (marker count vs valid verdict count mismatch) -- possible injection, see PR comment for details"
    return 1
  fi

  last_block=$(last_verdict "$verdicts")
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
  if [ -z "$last_block" ]; then
    echo "::warning::${prefix}output missing a valid trailing decision block -- treated as non-blocking"
    return 0
  fi
  # a decision marker exists but its final block is malformed -- fail
  echo "::error::${prefix}found a malformed trailing decision block -- see PR comment for details"
  return 1
}
