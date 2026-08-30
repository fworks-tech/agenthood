#!/usr/bin/env bash
set -euo pipefail

# The Auditor — fail on high/critical vulnerabilities in project dependencies
# (npm itself, npm's own bundled deps, and the semantic-release release toolchain
# are exempt) and on ANY severity in production dependencies (--omit=dev: prod
# ships with the package, so no open advisory is acceptable there). Fail loudly
# when the audit itself fails: a transient network error or malformed output
# must not pass the gate silently. Only a clean audit result exits 0.

# severity floors for the two scope passes: prod fails on ANY severity,
# dev/all-scope fails only on high+ (npm and the semantic-release toolchain
# are exempt; they are dev-only CI/CD tooling, not shipped in the package)
SEVERITY_HIGH=3
SEVERITY_INFO=0
EXEMPT_NPM=1
NO_EXEMPT=0

# remove the temp file even when audit_output_check exits the script early
err_file_target=""
trap 'rm -f "$err_file_target"' EXIT

audit_fail_on() {
  # $1 label, $2 min severity, $3 exempt npm's own bundled deps
  local label="$1" min_level="$2" exempt_npm="$3"
  shift 3
  local json err_file
  # capture stderr instead of discarding it: the empty-output and malformed
  # fallbacks are only accurate when a real registry/network error is visible
  err_file=$(mktemp)
  err_file_target="$err_file"
  json=$(npm audit --json "$@" 2>"$err_file" || true)
  audit_output_check "$label" "$json" "$(<"$err_file")"
  # clear the trap target only after the file is gone, so the EXIT trap can
  # still clean it if audit_findings exits the script early
  rm -f "$err_file"
  err_file_target=""
  audit_findings "$label" "$min_level" "$exempt_npm" "$json"
}

audit_output_check() {
  local label="$1" json="$2" err="$3"
  if [ -z "$json" ]; then
    echo "::error::The Auditor: npm audit ($label) produced no output (registry unreachable?):"
    [ -n "$err" ] && echo "$err"
    exit 1
  fi
  if ! node -e "JSON.parse(process.argv[1])" "$json" 2>/dev/null; then
    echo "::error::The Auditor: npm audit ($label) output is not valid JSON:"
    [ -n "$err" ] && echo "$err"
    exit 1
  fi
}

audit_findings() {
  local label="$1" min_level="$2" exempt_npm="$3" json="$4"
  local filter findings status
  # route the filter through the shared .mjs helper so the shell layer reduces
  # to two branches. under `set -e` a nonzero node exit (1 or 2) would abort
  # before `status=$?` runs, so guard with `set +e` and re-enable afterwards.
  filter="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/audit-filter.mjs"
  set +e
  findings=$(node "$filter" "$json" "$min_level" "$exempt_npm")
  status=$?
  set -e

  if [ "$status" -eq 1 ]; then
    echo "::error::The Auditor: npm audit ($label) reported an upstream error."
    exit 1
  fi
  if [ "$status" -eq 2 ]; then
    echo "::error::The Auditor: unfixed vulnerabilities in $label:"
    echo "$findings"
    exit 1
  fi
}

audit_fail_on "project dependencies" "$SEVERITY_HIGH" "$EXEMPT_NPM"
audit_fail_on "production dependencies" "$SEVERITY_INFO" "$NO_EXEMPT" --omit=dev

echo "The Auditor: no high/critical vulnerabilities outside npm and the semantic-release toolchain; no production vulnerabilities."
