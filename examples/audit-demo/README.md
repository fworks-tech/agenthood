# Audit demo trail

A small, self-contained decision trail so `agenthood audit` can be shown and tested
without running a Society first.

**The events are sample data.** They describe a plausible review of the MCP client work
in issue #1072, but they are not a record of this repository's history. Do not read this
folder as evidence of work that happened; the real trail lives in `.agenthood/` in the
project where the run happened, and it is gitignored there on purpose.

## Run it

```bash
cd examples/audit-demo
npx agenthood audit
npx agenthood audit --strict
npx agenthood audit --json
```

The trail covers four decisions from four members, two routing records, and one trace
line per run. `--strict` exits 0 because every decision carries provenance, every
provenance entry sits in the hash chain, and both routing records pass validation.

## What the trail shows

| Member | Decision | Provenance |
|--------|----------|------------|
| architect | Scope the MCP client to a STDIO transport read from the project config | `prov-dec-1072-scope` |
| builder | Validate `command`, `args` and `env` per server, fail closed on an unknown transport | `prov-dec-1072-config` |
| reviewer | Require a test proving a missing `mcpServers` block keeps the previous behaviour | `prov-dec-1072-review` |
| auditor | Accept the change: chain intact, no decision without provenance | `prov-dec-1072-audit` |

The two routing records belong to The Mediator: a clear specialist at 88%, then a
capacity-sensitive route to The Reviewer at 81%.

## How the chain was built

The provenance files were written by the real `ProvenanceStore.track()`, in sequence, so
`previousChecksum` and `checksum` are genuine links rather than hand-written hashes. The
decisions, routing records and trace lines were written next to them, with
`metadata.decisionId` pointing each provenance entry at its decision.

`traces/traces.ndjson` carries one line per run keyed by `correlationId`, which equals the
provenance `entityId`. That is what makes the audit print duration, cost and tokens on the
provenance rows.

## Resetting it

`agenthood audit --clear` archives the trail to `.agenthood/archive/<timestamp>/` instead
of deleting it. To get the shipped demo back:

```bash
git checkout -- examples/audit-demo
```

## Why it is committed

The `.agenthood/` trail is gitignored at the repository root. This folder is the one
exception, re-included in `.gitignore`, and a test keeps it honest:
`tests/unit/examples/audit-demo.test.ts` fails if the chain, the coverage or the routing
records stop passing `--strict`.
