# Python Runtime (Experimental)

This directory contains the **experimental** Python runtime for Agenthood,
originally introduced in [ADR-006](../docs/adr/ADR-006-python-runtime-as-additive-layer.md)
and [ADR-007](../docs/adr/ADR-007-deepagents-as-execution-engine.md).

Both ADRs are **superseded** by [ADR-008](../docs/adr/ADR-008-typescript-runtime-over-python.md).
The single supported runtime is the **TypeScript CLI** at `src/`.

## What's here

- `agenthood_runtime/members/specs.py` — canonical `SubAgent` TypedDicts for
  all 14 members. The TS `MemberRegistry` at `src/members/MemberRegistry.ts`
  derives its tool scopes, permission profiles, and provider preferences from
  the same architecture docs.
- `agenthood_runtime/cli.py` — Python CLI skeleton.
- `agenthood_runtime/config.py` — config loading.
- `tests/` — unit tests for the Python member specs.

## Status

- **Phase 1** (member specs, loader, registry) — complete and maintained.
  These are the most valuable parts; they are a machine-readable spec of the
  14 members used by the TS runtime as reference.
- **Phases 2–5** (orchestrator, memory, rituals, portals) — **not implemented
  here**. These are implemented in TypeScript (`src/`) per ADR-008.

## Running

```bash
cd runtime
pip install -e .
python -m agenthood_runtime list
```

The Python runtime is not on the `npx agenthood` install path. To use the
supported runtime, run `npx agenthood run the-scribe "write a commit message"`
from the project root after building with `npm run build`.
