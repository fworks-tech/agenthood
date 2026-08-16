#!/usr/bin/env bash
set -euo pipefail

# The Auditor — fail on high/critical vulnerabilities in project dependencies
# (npm's own bundled deps are exempt) and on ANY severity in production
# dependencies (--omit=dev: prod ships with the package, so no open advisory is
# acceptable there). Fail loudly when the audit itself fails: a transient
# network error or malformed output must not pass the gate silently. Only a
# clean audit result exits 0.

# severity floors for the two scope passes: prod fails on ANY severity,
# dev/all-scope fails only on high+ (npm's own bundled deps are exempt)
SEVERITY_HIGH=3
SEVERITY_INFO=0
EXEMPT_NPM=1
NO_EXEMPT=0

audit_fail_on() {
  # $1 label, $2 min severity, $3 exempt npm's own bundled deps
  local label="$1" min_level="$2" exempt_npm="$3"
  shift 3
  local json err_file
  # capture stderr instead of discarding it: the empty-output and malformed
  # fallbacks are only accurate when a real registry/network error is visible
  err_file=$(mktemp)
  json=$(npm audit --json "$@" 2>"$err_file" || true)
  audit_output_check "$label" "$json" "$(<"$err_file")"
  rm -f "$err_file"
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
  local findings status
  findings=$(node -e "
    const a = JSON.parse(process.argv[1]);
    if (a.error) {
      console.error('npm audit error:', a.error.code || '', a.error.summary || '');
      process.exit(1);
    }
    const order = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
    const min = Number(process.argv[2]);
    const exemptNpm = process.argv[3] === '1';
    const bad = Object.values(a.vulnerabilities || {}).filter(v =>
      (order[v.severity] ?? 0) >= min &&
      (!exemptNpm || (v.nodes || []).some(n => !n.startsWith('node_modules/npm'))));
    for (const v of bad) console.log(v.name + ' [' + v.severity + '] ' + (v.nodes || []).join(', '));
    if (bad.length) process.exit(2);
  " "$json" "$min_level" "$exempt_npm")
  status=$?

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

echo "The Auditor: no high/critical vulnerabilities outside npm's bundled dependencies; no production vulnerabilities."