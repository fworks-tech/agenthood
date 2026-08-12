#!/usr/bin/env bash
set -euo pipefail

# The Auditor — fail on high/critical vulnerabilities in project dependencies
# (npm's own bundled deps are exempt), and fail loudly when the audit itself
# fails: a transient network error or malformed output must not pass the gate
# silently. Only a clean audit result exits 0.

AUDIT_JSON=$(npm audit --json 2>/dev/null || true)

if [ -z "$AUDIT_JSON" ]; then
  echo "::error::The Auditor: npm audit produced no output (registry unreachable?)."
  exit 1
fi

if ! node -e "JSON.parse(process.argv[1])" "$AUDIT_JSON" 2>/dev/null; then
  echo "::error::The Auditor: npm audit output is not valid JSON."
  exit 1
fi

real=$(node -e "
  const a = JSON.parse(process.argv[1]);
  if (a.error) {
    console.error('npm audit error:', a.error.code || '', a.error.summary || '');
    process.exit(1);
  }
  const bad = Object.values(a.vulnerabilities || {})
    .filter(v => (v.severity === 'high' || v.severity === 'critical')
      && (v.nodes || []).some(n => !n.startsWith('node_modules/npm')));
  for (const v of bad) console.log(v.name + ' [' + v.severity + '] ' + (v.nodes || []).join(', '));
  if (bad.length) process.exit(2);
" "$AUDIT_JSON")
AUDIT_STATUS=$?

if [ "$AUDIT_STATUS" -eq 1 ]; then
  echo "::error::The Auditor: npm audit reported an upstream error."
  exit 1
fi
if [ "$AUDIT_STATUS" -eq 2 ]; then
  echo "::error::The Auditor: unfixed high/critical vulnerabilities in project dependencies:"
  echo "$real"
  exit 1
fi
echo "The Auditor: no high/critical vulnerabilities outside npm's bundled dependencies."
