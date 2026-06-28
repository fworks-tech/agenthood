# Release Policy

> *The Society evolves. This is how that happens safely.*

---

## What this defines

- Who can change a member's SKILL.md
- Who approves behavior changes
- How breaking changes are announced
- Version numbering for member changes
- Deprecation policy for old member behavior

---

## Change Approval Rules

### Who can edit a member SKILL.md

| Change Type | Approver | Reviewer |
|-------------|----------|----------|
| Typo fix or formatting | Member owner (self-approve) | Any other member |
| Clarification of existing behavior | Member owner + 1 member in "Consult" column | The Sentinel |
| New responsibility added | The Architect + The Oracle | The Sentinel |
| Lane boundary change (new domain) | The Architect + The Oracle + The Sentinel | All members notified |
| Deprecation of old behavior | The Oracle + The Herald | All members notified |
| New member added | The Oracle + The Architect + The Sentinel | All members |

### The Oracle's role

The Oracle is the final arbiter of member naming, scope, and placement. Any new member or lane change must be approved by The Oracle. The Oracle checks:
1. Name fits the register (archaic/formal/noble nouns)
2. Lane does not overlap with existing members
3. Responsibilities map to existing or planned code components
4. SKILL.md follows the canonical 7-section template

---

## Version Numbering

### Member versions

Each member is versioned independently. The version is stored in the member's SKILL.md frontmatter and in `agenthood.lock` (when the `verify` and `rollback` commands are implemented).

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Typo or formatting | Patch (0.0.x) | 1.0.0 → 1.0.1 |
| Clarification or new example | Minor (0.x.0) | 1.0.0 → 1.1.0 |
| New responsibility or process step | Minor (0.x.0) | 1.0.0 → 1.2.0 |
| Removed responsibility or lane change | Major (x.0.0) | 1.0.0 → 2.0.0 |
| New member added | Major (x.0.0) | 1.0.0 → 2.0.0 |

### Agenthood runtime versions

The runtime (`package.json` version) follows [semantic-release](https://github.com/semantic-release/semantic-release) conventions:

| Commit Type | Version Bump |
|-------------|-------------|
| `fix(...)` | Patch |
| `feat(...)` | Minor |
| `BREAKING CHANGE` / `!` | Major |

The Herald determines the semver bump. The release process is automated via GitHub Actions and documented in the existing CI pipeline.

---

## Breaking Change Announcement

When a member's behavior changes in a way that affects adopters:

1. **The Herald** writes a release note entry in `docs/release-notes.md` under the upcoming version
2. **The Scribe** updates the member's SKILL.md with a `## Migration` section if applicable
3. **The Librarian** updates any academy articles referencing the old behavior
4. **The Envoy** checks that the translated provider files are updated for all supported providers
5. **The Sentinel** runs a drift check before release to confirm all member files are consistent

---

## Deprecation Policy

### When to deprecate

- A member's responsibility is absorbed by another member
- A process step is replaced by a more efficient alternative
- An old pattern is superseded by a new convention

### Deprecation process

1. **Mark as deprecated:** Add `status: deprecated` to the member's SKILL.md frontmatter
2. **Announce:** The Herald writes a deprecation notice in release notes
3. **Grace period:** Deprecated behavior remains functional for one minor version (e.g., 2.5.0 → 2.6.0)
4. **Removal:** After one minor version, the deprecated behavior is removed on the next major version

### Supersedes tracking

When a member or convention is replaced, the new one must reference the old one via a `supersedes` edge in the Society index (`SocietyIndexer` handles this in `.agenthood/society-graph.json`). This edge is declared in the SKILL.md frontmatter:

```yaml
---
name: the-reviewer
supersedes: the-manuscript
---
```

---

## Compliance

- All SKILL.md changes are validated by `npx agenthood verify` (when implemented in M6)
- All member behavior changes are logged to the Decision Log
- The Sentinel audits member files for drift on every `init` and periodically via scheduled run
- CI enforces that no SKILL.md changes ship without a passing `verify`
