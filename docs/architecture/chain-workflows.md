# Chain Workflows

> *A workflow you declare, not one you install.*

`chains.yaml` at the project root declares an ordered sequence of members. The
CLI executes it through `WorkflowEngine`, one member per step, each step run by
`MemberRunner`. See [ADR-033](../adr/ADR-033-chain-workflows.md).

## Shape

```yaml
chains:
  - name: build
    sequence:
      - member: tester
      - member: builder
        task: implement issue #42          # optional per-step override
      - member: reviewer
      - member: doorman
    guards: { stop_on_blocking: true }
    max_rounds: 3
```

- `name` — chain name, unique per file.
- `sequence` — one or more `{ member, task? }` entries. Order is execution order.
- `guards.stop_on_blocking` — stop the chain when a member output contains
  `[blocking]`.
- `max_rounds` — re-run the sequence while a round ends blocked, up to this
  count. Defaults to 1.
- `doorman_before_merge`, `scribe_before_commit` — parsed as policy; the CLI
  runner does not intercept commits or merges.

Malformed entries fail closed and name the file and index.

## Running

```bash
agenthood workflow list
agenthood workflow run build "implement issue #42"
```

Every step goes through `MemberRunner`, so checkpoints, decisions, provenance,
events and per-step trajectories are recorded exactly as a direct
`agenthood run` would. The task argument is shared by every step unless the step
declares its own.

## What chains are not

- Not parallel: no fan-out or conditional branches in 4.0.
- Not a scheduler: a chain runs once per invocation; rituals and queues are
  outside it.
- Not a policy engine: guards express stop conditions, not approval flows.

Built-in workflows such as `review-pr` remain available and are unaffected.
