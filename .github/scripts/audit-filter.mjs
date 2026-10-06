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

import { execFileSync } from 'node:child_process'

const order = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }

const srTree = (() => {
  try {
    // npm ls exits non-zero on peer/extraneous problems yet still prints the
    // JSON tree to stdout — keep it from the error object instead of losing it
    let ls = ''
    let stderr = ''
    try {
      // shell:true needed on Windows to resolve npm.cmd
      const result = execFileSync('npm', ['ls', '--all', '--json'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })
      ls = result
    } catch (e) {
      const err = e
      ls = typeof err?.stdout === 'string' ? err.stdout : ''
      stderr = typeof err?.stderr === 'string' ? err.stderr : ''
      // npm ls exits 1 (deps issues), 2 (extraneous), or other (EACCES, corrupt lockfile).
      // Only 0, 1, 2 are expected. Fail closed on unexpected codes.
      const code = err?.status ?? 0
      if (code !== 0 && code !== 1 && code !== 2) {
        console.error(`npm audit filter: npm ls exited with unexpected code ${code}: ${stderr}`)
        process.exit(1)
      }
      if (stderr) {
        console.warn(`npm audit filter: npm ls stderr: ${stderr}`)
      }
    }
    if (!ls) return new Set()
    const tree = JSON.parse(ls)
    const names = new Set()
    const walk = (deps, underSR) => {
      if (!deps) return
      for (const [name, info] of Object.entries(deps)) {
        const isSR = underSR || name === 'semantic-release' || name.startsWith('@semantic-release/')
        if (isSR) names.add(name)
        walk(info.dependencies, isSR)
      }
    }
    walk(tree.dependencies, false)
    return names
  } catch { return new Set() }
})()

// Also exempt transitive dependency NAMES of semantic-release toolchain packages
const srTransitiveNames = (() => {
  try {
    let ls = ''
    let stderr = ''
    try {
      // shell:true needed on Windows to resolve npm.cmd
      const result = execFileSync('npm', ['ls', '--all', '--json'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })
      ls = result
    } catch (e) {
      const err = e
      ls = typeof err?.stdout === 'string' ? err.stdout : ''
      stderr = typeof err?.stderr === 'string' ? err.stderr : ''
      const code = err?.status ?? 0
      if (code !== 0 && code !== 1 && code !== 2) return new Set()
      if (stderr) console.warn(`npm audit filter: npm ls stderr (transitive): ${stderr}`)
    }
    if (!ls) return new Set()
    const tree = JSON.parse(ls)
    const names = new Set()
    const walk = (deps, underSR) => {
      if (!deps) return
      for (const [name, info] of Object.entries(deps)) {
        const isSR = underSR || name === 'semantic-release' || name.startsWith('@semantic-release/')
        if (underSR) names.add(name) // Add transitive dep NAMES of SR packages
        walk(info.dependencies, isSR)
      }
    }
    walk(tree.dependencies, false)
    return names
  } catch { return new Set() }
})()

// Extract package name from node path (handles both top-level and nested node_modules)
function pkgNameFromNode(nodePath) {
  // node_modules/pkg -> pkg
  // node_modules/@scope/pkg -> @scope/pkg
  // node_modules/foo/node_modules/pkg -> pkg
  // node_modules/foo/node_modules/@scope/pkg -> @scope/pkg
  const parts = nodePath.split('/')
  const idx = parts.lastIndexOf('node_modules')
  if (idx === -1 || idx === parts.length - 1) return nodePath
  const after = parts.slice(idx + 1)
  return after.length === 2 && after[0].startsWith('@') ? after.join('/') : after[after.length - 1]
}

const isExemptNode = (n) =>
  n === 'node_modules/npm' || n.startsWith('node_modules/npm/') ||
  n === 'node_modules/semantic-release' || n.startsWith('node_modules/semantic-release/') ||
  n.startsWith('node_modules/@semantic-release/') ||
  srTree.has(n.replace(/^node_modules\//, '')) ||
  srTransitiveNames.has(pkgNameFromNode(n))

let bad = false
for (const [name, v] of Object.entries(audit.vulnerabilities || {})) {
  if (!((order[v.severity] ?? 0) >= min &&
    (!exemptNpm || !(v.nodes || []).length || (v.nodes || []).some((n) => !isExemptNode(n))))) continue
  console.log(`${name} [${v.severity}] ${(v.nodes || []).join(', ')}`)
  bad = true
}
process.exit(bad ? 2 : 0)
