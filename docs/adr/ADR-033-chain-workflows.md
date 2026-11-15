# ADR-033: Chains as Runtime Workflows

**Date:** 2026-11-15
**Status:** Accepted

## Context

`chains.yaml` shipped with the repository describing how members sequence
(`build`: tester → builder → reviewer → doorman). Nothing read it. The
`WorkflowEngine` existed too, but only the built-in `review-pr` used it, with
protocols that print a delegation notice rather than run a member.

So the composition story lived in a file that was effectively a comment.

## Decision

`chains.yaml` becomes a runtime input.

```
agenthood workflow list
agenthood workflow run build "implement issue #42"
```

- Each chain step is an engine step carrying `{member, task}` and a
  `MemberProtocol` that calls `MemberRunner.runMemberTask`. Decisions,
  provenance, events and traces therefore behave exactly as a direct run.
- Sequential steps only. Parallel and conditional steps are deliberately out of
  scope for 4.0.
- `guards.stop_on_blocking` maps to the reviewer/doorman convention: a member
  output containing `[blocking]` stops the chain.
- `max_rounds` re-runs the sequence while budget remains, which is the
  build→review→revise loop expressed as data.
- `review-pr` stays a built-in workflow; chains are additive.

`doorman_before_merge` and `scribe_before_commit` are parsed and preserved as
policy for the live orchestrator, but the CLI runner cannot intercept commits
or merges, so it does not claim to enforce them.

## Consequences

- A host can compose a workflow without writing TypeScript.
- Malformed chains fail closed with the file and index named.
- A chain that blocks costs the round, not the run; `max_rounds` caps the retry.
- Chain runs are as expensive as the members involved — there is no dry run.
