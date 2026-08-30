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
  err_file_target=""
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
  # guard the command substitution: under `set -e` a nonzero node exit (1 or 2)
  # would abort the script before `status=$?` runs, leaving the ::error::
  # branches below unreachable. `set +e` lets branch normalize the exit code.
  set +e
  findings=$(node -e "
    const a = JSON.parse(process.argv[1]);
    if (a.error) {
      console.error('npm audit error:', a.error.code || '', a.error.summary || '');
      process.exit(1);
    }
    const order = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
    const min = Number(process.argv[2]);
    const exemptNpm = process.argv[3] === '1';
    // An advisory node is exempt when it lives inside npm, npm's bundled deps,
    // or the dev-only semantic-release toolchain (semantic-release and its
    // @semantic-release/* plugins). Exact-path matching keeps the gate from
    // silently exempting a sibling package like semantic-release-foo.
    const isExemptNode = (n) =>
      n === 'node_modules/npm' || n.startsWith('node_modules/npm/') ||
      n === 'node_modules/semantic-release' || n.startsWith('node_modules/semantic-release/') ||
      n.startsWith('node_modules/@semantic-release/');
    // Report any advisory where at least one node is NOT exempt — a mixed-node
    // advisory (real project dep + npm bundled dep) must still fail the gate.
    // A missing/empty node list is treated as non-exempt (fail closed: lack of
    // data must not silently pass the gate).
    // Note: when exemptNpm is false (--omit=dev pass), severity is the only
    // filter — the !exemptNpm short-circuit keeps that pass unaffected.
    const bad = Object.values(a.vulnerabilities || {}).filter(v =>
      (order[v.severity] ?? 0) >= min &&
      (!exemptNpm || !(v.nodes || []).length || (v.nodes || []).some(n => !isExemptNode(n))));
    for (const v of bad) console.log(v.name + ' [' + v.severity + '] ' + (v.nodes || []).join(', '));
    if (bad.length) process.exit(2);
  " "$json" "$min_level" "$exempt_npm")
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
