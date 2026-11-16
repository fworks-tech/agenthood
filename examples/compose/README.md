# Compose

Two things 4.0 makes data:

1. **`chains.yaml`**: copy it to your project root and run
   `agenthood workflow run compose-demo "<task>"`. The chain runs architect →
   builder → reviewer, stopping on a blocking finding, with at most two rounds.
2. **`compose.ts`**: a host registering a custom member (`release-scribe`) and
   running it in-process. The member is restricted to read-only tools; the
   permission profile is intersected with `tools`, never widened.

See [docs/architecture/chain-workflows.md](../../docs/architecture/chain-workflows.md)
and [MIGRATION.md](../../MIGRATION.md).
