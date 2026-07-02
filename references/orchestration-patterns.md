# Orchestration Patterns

## Layers

| Layer | What | Example |
|---|---|---|
| Skill | Workflow with steps and exit criteria | code-review |
| Member | Role with perspective and output format | the-reviewer |
| Command | User-facing entry point | `agenthood run the-reviewer` |

## Rules

1. Members do not invoke other members. Composition is the job of commands or the user.
2. A member may invoke skills (the how).
3. Fan-out: multiple members run independently in parallel, main agent merges results.
4. Stacked: member A output feeds into member B input sequentially.

## Patterns

### Fan-Out (Parallel)
```
task -- member-A --\
      -- member-B ---- merge -- output
      -- member-C --/
```
When: sub-tasks are independent, no shared state, no ordering constraints.

### Stacked (Sequential)
```
task -- member-A -- member-B -- member-C -- output
```
When: each step depends on the previous step's output.
