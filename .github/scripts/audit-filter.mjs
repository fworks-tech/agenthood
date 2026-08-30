#!/usr/bin/env node
// The Auditor — shared npm-audit advisory filter.
// Reads the audit JSON from argv[2], the min severity and npm-exemption flag
// from argv[3]/argv[4] (argv[0]=node, argv[1]=script path), prints matching
// advisories to stdout, and exits:
//   0 — clean (no qualifying advisories)
//   1 — npm audit reported an upstream error (a.error set)
//   2 — one or more vulnerabilities meet the severity/exemption filter
//
// Severity floors: info=0, low=1, moderate=2, high=3, critical=4. A min of 3
// (high) fails on high+; a min of 0 fails on ANY severity.
//
// Exemption: an advisory node is exempt when it lives inside npm, npm's bundled
// deps, or the dev-only semantic-release toolchain (semantic-release and its
// @semantic-release/* plugins). Exact-path matching keeps the gate from
// silently exempting a sibling like semantic-release-foo. An advisory where at
// least one node is NOT exempt still fails the gate (a real project dep in a
// mixed advisory must never pass), and a missing/empty node list is treated as
// non-exempt (fail closed: lack of data must not silently pass).

let audit
try {
  audit = JSON.parse(process.argv[2])
  if (audit === null || typeof audit !== 'object' || Array.isArray(audit)) throw new SyntaxError('not an object')
  if (
    audit.vulnerabilities !== undefined &&
    (audit.vulnerabilities === null ||
      typeof audit.vulnerabilities !== 'object' ||
      Array.isArray(audit.vulnerabilities))
  )
    throw new SyntaxError('bad vulnerabilities')
} catch {
  // audit_output_check validates JSON first, so this is unreachable in
  // normal CI flow; treat malformed, primitive, or array input as an
  // upstream error (exit 1) with a distinct message so the branch is not
  // mislabeled as a vuln
  console.error('npm audit error: malformed JSON')
  process.exit(1)
}
const min = Number(process.argv[3])
const exemptNpm = process.argv[4] === '1'

if (audit.error) {
  console.error('npm audit error:', audit.error.code || '', audit.error.summary || '')
  process.exit(1)
}

const order = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }
const isExemptNode = (n) =>
  n === 'node_modules/npm' || n.startsWith('node_modules/npm/') ||
  n === 'node_modules/semantic-release' || n.startsWith('node_modules/semantic-release/') ||
  n.startsWith('node_modules/@semantic-release/')

let bad = false
for (const [name, v] of Object.entries(audit.vulnerabilities || {})) {
  if (!((order[v.severity] ?? 0) >= min &&
    (!exemptNpm || !(v.nodes || []).length || (v.nodes || []).some((n) => !isExemptNode(n))))) continue
  console.log(`${name} [${v.severity}] ${(v.nodes || []).join(', ')}`)
  bad = true
}
process.exit(bad ? 2 : 0)
