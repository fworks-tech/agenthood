# ADR-043: Dependency Audit Exception Policy

**Date:** 2026-11-17
**Status:** Accepted

## Context

The Auditor gate (`.github/scripts/audit-check.sh` calling `audit-filter.mjs`) runs twice on every
PR: once over the whole tree, failing on `high` and above, and once with `--omit=dev`, failing on any
severity because that is the dependency set the published package ships.

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (picomatch ReDoS through
single-branch repeated extglobs, CWE-1333, CVSS 7.5) covers the range `<=4.0.7`, and `4.0.7` is
every version npm has: `npm view picomatch version` and `npm view picomatch versions` both end there.
Eight packages go red through `tinyglobby`/`fdir` and `micromatch`: `picomatch`, `fdir`,
`tinyglobby`, `micromatch`, `vite`, `vitest`, `@vitest/coverage-v8` and
`@typescript-eslint/typescript-estree`. `npm audit` proposes downgrading `vitest` to `3.1.4`, which
undoes two minor versions and is not a patch.

The published CLI does not load any of them at runtime: `npm audit --omit=dev --audit-level=low`
reports zero findings. The exposure is limited to the dev and release toolchain.

Two naive answers are wrong. Leaving the gate red blocks every PR on an advisory nobody can fix
today. Removing the check, or raising its threshold, stops the Society from seeing every future
advisory. A gate that cannot tell a known, scoped risk from a new one is not a gate.

## Decision

**Exceptions live in one dated allowlist, and the gate stays strict everywhere else.** Each
`ADVISORY_ALLOWLIST` entry in `.github/scripts/audit-filter.mjs` carries four fields:

| Field | Meaning |
|-------|---------|
| `id` | the GHSA identifier, one advisory per entry |
| `packages` | the package names that advisory is allowed to affect |
| `reason` | one line a reviewer can judge without opening the advisory |
| `expires` | ISO `YYYY-MM-DD` after which the entry dies |

An entry clears a package only when all four conditions hold:

1. the run is the broad dev pass (`exemptNpm`, which `audit-check.sh` sets only for the dev call);
2. the run date is on or before `expires`;
3. the package rests on that advisory and no other unaccepted one;
4. every node npm reports for that advisory resolves to a package in `packages`.

Any node outside the list, an advisory that is not listed, or an empty node list fails the gate. An
expired entry fails the gate with exit 2 and prints the date that passed, rather than dropping the
advisory quietly. An active entry prints `::warning::` naming the advisory, its expiry and the
reason, so the exception is visible in the PR annotations instead of buried in a script.

The production pass is untouched: `--omit=dev` accepts no entry, at any severity. If a future
advisory reaches the shipped dependency tree, the gate fails regardless of this list.

**Renewal is a new decision.** Extending `expires` requires editing the entry and recording why in
the PR; it is not a background bump. When a patched `picomatch` ships, the entry is deleted and the
dependents are upgraded, which is the preferred fix.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Downgrade `vitest` to 3.1.4 (npm's suggestion) | clears the advisory | loses two minor versions, and `@vitest/coverage-v8` moves with it | Rejected: a regression sold as a fix |
| `overrides` to force a patched `picomatch` | one line | no patched version exists; `micromatch@4` declares `picomatch ^2`, so a cross-major override breaks a consumer | Rejected: nothing to point at |
| Keep the gate red until upstream ships | honest | blocks every PR on a dev-only advisory the package never loads | Rejected: stalls all work on a date nobody controls |
| Delete the audit step or lower `--audit-level` | green with no logic | hides every future advisory, not just this one | Rejected: silent bypass |
| Comment out the failing packages | minimal diff | invisible at review time, and it rots | Rejected: no expiry, no scope |
| Scoped, expiring allowlist | gate stays honest and green, exception is visible and bounded | needs a renewal decision if upstream is still unfixed at expiry | Accepted |

## Consequences

- The dev pass is green while the advisory is unpatched, and the annotation says exactly which
  advisory and until when.
- The scope is narrow in three directions: dev only, one advisory, and one package. A different
  package or a different advisory on `picomatch` still fails.
- The exception cannot outlive `2027-02-01`: the gate fails on its own, which turns an unnoticed risk
  into a scheduled one.
- The production pass remains exception-free, so the weakest part of the argument (a dev dependency)
  never reaches an adopter.
- Future advisories with no fix follow the same shape; this ADR is the policy, not a one-off.
