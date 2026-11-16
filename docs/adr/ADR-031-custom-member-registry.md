# ADR-031: Custom Member Registry

**Date:** 2026-11-15
**Status:** Accepted

## Context

Hosts embedding agenthood (Atlaslink first) needed agents that are not part of
the packaged Society. They were emulating this with persona overlays: store
`name, displayName, persona, baseMember, provider, model`, then map each row
onto a built-in member at run time. The mapping dropped `model` entirely and
could not narrow tools, so a tenant agent could not be less privileged than the
member it pretended to be.

The alternative was for hosts to fork the registry or to register members by
writing files into the package: both make upgrades hostile.

## Decision

`MemberRegistry.register(def)` accepts a `CustomMemberDefinition` and
`ApplicationContext.create` takes `customMembers`, so a host registers its
agents as data at construction time. The definition carries `name`,
`description`, `systemPrompt`, `permissionProfile`, `preferredProvider`,
`tools`, `model` and `canDelegate`. `tools` is intersected with the profile:
custom members can narrow access, never widen it. `model` is honored for that
member's run.

The registry rejects a name that collides with a packaged member, so a custom
agent can never shadow `reviewer` or `builder`.

## Consequences

- One additive constructor option; no call-site break.
- The overlay pattern is no longer necessary and `model` actually applies.
- Custom members are registered per process, not persisted by agenthood; the
  host owns storage.
- Members become data, which is the 4.0 thesis: a platform you compose.
