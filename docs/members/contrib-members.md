# Third-Party Members

The Society ships its members in `skills/`, all first-party. This page is the
authoring contract for a member that lives outside this repository: a
`contrib` member, so it can be reviewed, installed, versioned and updated
without forking.

The design decisions are in [ADR-035](../adr/ADR-035-skill-namespaces-and-remote-catalogs.md)
(namespaces, flat on-disk identity) and [ADR-036](../adr/ADR-036-script-execution-security.md)
(script execution).

## Where a contrib member lives

```
skills/contrib/the-<name>/
├── SKILL.md           ← required; the member's identity and instructions
├── references/        ← optional; long material the body points at
└── scripts/           ← optional; bundled executables (ADR-036)
```

Discovery walks `skills/` to depth 6, so `contrib/` needs no registration. The
same layout works in a project (`<repo>/skills/contrib/…`), in user scope
(`~/.agents/skills/`, XDG on Linux/macOS), or in a published package.

Do **not** put a second `SKILL.md` elsewhere for the same member: the Sentinel
rejects duplicate definitions, and `agenthood verify --dedup` reports a name
installed in more than one root.

## Identity and namespacing

| Layer | Official member | Contrib member |
|-------|-----------------|----------------|
| Directory | `skills/the-<name>/` | `skills/contrib/the-<name>/` |
| Frontmatter `name` | `the-<name>` | `the-<name>` (flat, no owner) |
| Registry key | `fworks-tech/the-<name>` | `<author>/the-<name>` |

The owner is a registry qualifier, never part of the directory or the
frontmatter `name` (ADR-035). A leading `@` is accepted on the command line
(`agenthood install @<author>/the-<name>`) and stripped; it is not stored on
disk. Owner names are lowercase, digits and single hyphens.

## Required frontmatter

```yaml
---
name: the-example
description: One sentence, front-loaded with the trigger keywords.
license: MIT
metadata:
  author: your-handle        # required for contrib: becomes the owner
  version: 0.1.0             # semver; drives the lockfile and `agenthood bump`
source_url: https://github.com/you/the-example
---
```

`agenthood verify --contrib` reports a `skills/contrib/*/SKILL.md` with no
`metadata.author` or no `source_url`. Both are advisory in the report and
blocking in review: an unowned contrib skill cannot be published, safely
updated, or attributed.

## Trust model

Contrib members are **not** trusted by default. The three gates:

1. **Structure**. The Sentinel (and `agenthood verify`) checks the required
   sections, naming and frontmatter.
2. **Security**. The Auditor reviews anything that can execute code. Bundled
   scripts run in Docker by default; a host run needs the author on the trusted
   list (ADR-036).
3. **Runtime permissions**: a member's `permissionProfile` decides its tools.
   The default profile is read-only, and `delegate_task` is opt-in and limited
   to read-only analysis roles.

A reviewed contrib member is listed in the registry only after all three pass.

## Versioning and updates

Every contrib member carries `metadata.version`. `agenthood.lock` pins the
SKILL.md hash, so drift is detectable, and `agenthood verify --update-lock`
re-locks after an intentional edit. A contrib member may release on its own
cadence: publishing a new version does not require an Agenthood release, but a
major bump must say what breaks in the skill body.

## Reference implementation

[`examples/contrib/the-example/SKILL.md`](../../examples/contrib/the-example/SKILL.md)
is a complete, minimal contrib member. Copy it, rename the directory and the
`name`, then fill in the Process section.
