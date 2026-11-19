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

# assert_mode <name> <expected-exit> <file> <mode>
assert_mode() {
  local got; got=$(check_decision_gate "$3" "" "$4" >/dev/null 2>&1; echo $?)
  if [ "$got" = "$2" ]; then
    echo "ok   - $1"
  else
    echo "FAIL - $1 (expected exit $2, got $got)"; fail=1
  fi
}

printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0-->\n' > "$tmp/no-space"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0 -->\n' > "$tmp/space"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0   -->\n' > "$tmp/multi-space"
printf '## BLOCKING\n- MIGRATION.md:35 is missing a rollback step\n<!--AGENTHOOD_DECISION: blocking=true warnings=0-->\n' > "$tmp/blocking"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=5-->\n' > "$tmp/too-many"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0\n' > "$tmp/truncated"
printf 'some prose\n  <!--AGENTHOOD_DECISION: blocking=true warnings=0-->\ntrailing text\n' > "$tmp/quoted-in-prose"
printf -- '- [blocking] MIGRATION.md:35 needs a rollback step\n<!--AGENTHOOD_DECISION: blocking=true warnings=0-->\n' > "$tmp/inline-blocking"
printf '## BLOCKING\n**MIGRATION.md:35** is missing a rollback step\n<!--AGENTHOOD_DECISION: blocking=true warnings=0-->\n' > "$tmp/bold-title-blocking"
printf '<!--AGENTHOOD_DECISION: blocking=false warnings=0-->\n<!--AGENTHOOD_DECISION: blocking=true warnings=1-->\n' > "$tmp/conflicting"

assert "valid marker, no space -> pass"        0 "$tmp/no-space"
assert "valid marker, one space -> pass (#756)" 0 "$tmp/space"
assert "valid marker, many spaces -> pass"      0 "$tmp/multi-space"
assert "blocking=true -> fail"                  1 "$tmp/blocking"
assert "warnings over threshold -> fail"        1 "$tmp/too-many"
assert "truncated (no -->) -> fail-closed"      1 "$tmp/truncated"
assert "quoted marker mid-prose -> not a verdict" 0 "$tmp/quoted-in-prose"
assert "inline [blocking] bullet -> fail"        1 "$tmp/inline-blocking"
assert "bold title in BLOCKING counts as finding -> fail" 1 "$tmp/bold-title-blocking"
assert "conflicting blocks -> fail"             1 "$tmp/conflicting"

assert_mode "advisory ignores a blocking verdict" 0 "$tmp/blocking" advisory
assert_mode "blocking fails a blocking verdict"   1 "$tmp/blocking" blocking
assert_mode "advisory ignores warnings over threshold" 0 "$tmp/too-many" advisory
assert_mode "advisory still fails conflicting blocks" 1 "$tmp/conflicting" advisory

# F2: an oversized comment body is capped below the API ceiling, with a note
head -c 70000 /dev/zero | tr '\0' 'x' > "$tmp/big-body.md"
cap_comment_bytes "$tmp/big-body.md"
big_bytes=$(wc -c < "$tmp/big-body.md" | tr -d ' ')
if [ "$big_bytes" -le 65536 ] && grep -q 'comment truncated' "$tmp/big-body.md" && grep -q 'byte comment ceiling' "$tmp/big-body.md"; then
  echo "ok   - oversized comment body capped with a truncation note"
else
  echo "FAIL - oversized comment body capped with a truncation note"; fail=1
fi

printf 'small body\n' > "$tmp/small-body.md"
cp "$tmp/small-body.md" "$tmp/small-body.orig"
cap_comment_bytes "$tmp/small-body.md"
if cmp -s "$tmp/small-body.md" "$tmp/small-body.orig"; then
  echo "ok   - comment body under the ceiling is untouched"
else
  echo "FAIL - comment body under the ceiling is untouched"; fail=1
fi

# F6: the diff payload binds on the 100KB byte cap with a marker, not on
# MAX_FILES (the file-name cap only trims the listing)
head -c 150000 /dev/zero | tr '\0' 'a' | fold -w 100 > "$tmp/big-stream.txt"
cap_stream_bytes "$tmp/stream-marker" < "$tmp/big-stream.txt" > "$tmp/capped-stream.txt" || true
stream_bytes=$(wc -c < "$tmp/capped-stream.txt" | tr -d ' ')
if [ "$stream_bytes" -le 101000 ] && [ -s "$tmp/stream-marker" ] && grep -q '(diff truncated at ~100KB)' "$tmp/capped-stream.txt"; then
  echo "ok   - oversized stream binds on the byte cap with a marker"
else
  echo "FAIL - oversized stream binds on the byte cap with a marker"; fail=1
fi

printf 'small line\n' | cap_stream_bytes "$tmp/small-marker" > "$tmp/small-stream.txt"
if [ "$(cat "$tmp/small-stream.txt")" = "small line" ] && [ ! -e "$tmp/small-marker" ]; then
  echo "ok   - stream under the cap passes through unmarked"
else
  echo "FAIL - stream under the cap passes through unmarked"; fail=1
fi

if grep 'git diff' .github/scripts/agent-analysis.sh | grep -q MAX_FILES; then
  echo "FAIL - MAX_FILES stays out of the diff pipelines"; fail=1
else
  echo "ok   - MAX_FILES stays out of the diff pipelines"
fi

[ "$fail" -eq 0 ] && echo "all decision-gate checks passed" || echo "decision-gate checks FAILED"
exit "$fail"
