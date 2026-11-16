# ADR-032: Enforce Skill Tool Declarations

**Date:** 2026-11-15
**Status:** Accepted

## Context

Skills have declared `allowed-tools` since the frontmatter contract landed
(ADR-028), but nothing enforced it: a skill that said it would only read files
could still write them. A declaration that is not enforced is documentation
that drifts from behaviour, and for a security-shaped field that is worse than
having none.

Enforcement is a breaking change: a skill that quietly used an undeclared tool
now fails that call.

## Decision

`allowed-tools` is parsed onto the manifest and enforced in `ReActLoop` at call
time, before the tool executes.

- The effective set is the intersection of the active skills' declarations, kept
  separate from the member's permission profile. A skill that declares tools
  can only narrow the scope; a permissive skill cannot re-widen a restrictive
  one that is also active. `ToolRegistry` still decides what a member may call,
  so the two are intersected as well.
- A skill that declares nothing imposes nothing: absence of the field means
  "member tools", not "no tools".
- `activate_skill` is always allowed, otherwise activating a second skill would
  be impossible under the first skill's scope.
- A denial returns a visible error to the model and emits `tool.denied`, so the
  refusal is auditable rather than a silent no-op.

Declared names are the spec vocabulary (`file.read`); tool calls carry
implementation names (`read_file`). `toolVocabulary.ts` derives the translation
from the existing tool map instead of duplicating it.

## Consequences

- Skills must declare every tool they use; the error message names the allowed
  set so the fix is mechanical.
- Delegation is declarable (`delegate_task`) but no longer free inside an active
  scope.
- Denials are observable in the event stream and in step trajectories.
- Enforcement reads `ExecutionContext.skillAllowedTools`. `ApplicationContext`
  always wires it, but a hand-built context that omits it skips enforcement
  entirely. Hosts that build contexts themselves must set the hook.
