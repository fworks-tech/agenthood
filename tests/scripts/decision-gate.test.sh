#!/usr/bin/env bash
# Runnable regression check for decision-gate.sh (#756).
# Run: bash tests/scripts/decision-gate.test.sh   (exits 1 on any failed assert)
set -uo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=/dev/null
source .github/scripts/decision-gate.sh

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0

# gate <file> ; echoes exit code of check_decision_gate
gate() { check_decision_gate "$1" >/dev/null 2>&1; echo $?; }

# assert <name> <expected-exit> <file>
assert() {
  local got; got=$(gate "$3")
  if [ "$got" = "$2" ]; then
    echo "ok   - $1"
  else
    echo "FAIL - $1 (expected exit $2, got $got)"; fail=1
  fi
}

printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0-->\n' > "$tmp/no-space"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0 -->\n' > "$tmp/space"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0   -->\n' > "$tmp/multi-space"
printf '<!--AGENTHOOD_DECISION: blocking=true warnings=0-->\n' > "$tmp/blocking"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=5-->\n' > "$tmp/too-many"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0\n' > "$tmp/truncated"
printf 'some prose\n  <!--AGENTHOOD_DECISION: blocking=true warnings=0-->\ntrailing text\n' > "$tmp/quoted-in-prose"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0-->\n<!--AGENTHOOD_DECISION: blocking=true warnings=1-->\n' > "$tmp/conflicting"

assert "valid marker, no space -> pass"        0 "$tmp/no-space"
assert "valid marker, one space -> pass (#756)" 0 "$tmp/space"
assert "valid marker, many spaces -> pass"      0 "$tmp/multi-space"
assert "blocking=true -> fail"                  1 "$tmp/blocking"
assert "warnings over threshold -> fail"        1 "$tmp/too-many"
assert "truncated (no -->) -> fail-closed"      1 "$tmp/truncated"
assert "quoted marker mid-prose -> not a verdict" 0 "$tmp/quoted-in-prose"
assert "conflicting blocks -> fail"             1 "$tmp/conflicting"

[ "$fail" -eq 0 ] && echo "all decision-gate checks passed" || echo "decision-gate checks FAILED"
exit "$fail"
