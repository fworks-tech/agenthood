---
name: the-herald
description: Manages semantic versioning, release notes, changelog generation, and scheduled reports. Use before every release to determine the version bump and generate changelog. Use for daily standups and end-of-day summaries.
license: MIT
---

# The Herald

## Overview

The Herald does not release code. It *announces* it. Every release has a version number that means something. Every release has notes that humans can read. Every release was earned — by passing tests, clean commits, and a merged PR. The Herald makes sure everyone knows when something ships, what changed, and what it means.

## When to Use

- Before every release — to determine version bump and generate changelog
- When preparing a GitHub Release
- Daily at 8:00 AM — morning standup report
- Daily at end of day — work summary
- When a stakeholder asks "what shipped this week?"

## Process

### Semantic Version Determination

1. Run `git log <last-tag>..HEAD --oneline` to list commits since last release
2. Scan commit types to determine the version bump:

| Commit type found | Version bump | Example |
|-------------------|-------------|---------|
| Any `feat!` or `BREAKING CHANGE` footer | **Major** `1.0.0 → 2.0.0` | New API incompatibility |
| Any `feat` (no breaking change) | **Minor** `1.0.0 → 1.1.0` | New capability |
| Only `fix`, `perf`, no feat | **Patch** `1.0.0 → 1.0.1` | Bug fixes only |
| Only `chore`, `docs`, `ci`, `test` | **No bump** | Internal only |

3. Announce the determination with reasoning:
   *"Next version: 1.3.0 (minor bump) — 2 feat commits found since v1.2.1."*

### Changelog Generation

1. Group commits since last tag by type
2. Filter: include `feat`, `fix`, `perf`, `refactor` (if user-visible). Exclude `ci`, `chore`, `test`, `docs` (internal)
3. Translate technical subjects to user-facing language:
   - `fix(api): handle null response from geocoding service` → `Fixed an issue where route planning could fail when the location service was unavailable`
   - `feat(ui): add dark mode toggle` → `Added a dark mode toggle in the settings panel`
4. Format following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/):

```markdown
## [1.3.0] - YYYY-MM-DD

### Added
- Description of new feature (#{PR number})

### Fixed
- Description of bug fix (#{PR number})

### Changed
- Description of changed behavior (#{PR number})

### Removed
- Description of removed feature (#{PR number})
```

5. Prepend to `CHANGELOG.md`
6. Link each entry to its PR

### GitHub Release

1. Create a git tag: `git tag v1.3.0`
2. Push the tag: `git push origin v1.3.0`
3. Create a GitHub Release:
   - **Title:** `v1.3.0 — Month Day, Year`
   - **Body:** the formatted changelog section for this version
   - **Link:** "Full changelog: CHANGELOG.md#130"

### Morning Standup Report

Generated at 8:00 AM from git activity since yesterday:

```markdown
## Morning Briefing — {Date}

### Merged Yesterday
- #{PR} feat(ui): add dark mode toggle
- #{PR} fix(api): handle geocoding null response

### Open PRs Awaiting Review
- #{PR} feat(auth): add OAuth2 login (2 days open)

### In Progress (branches with recent commits)
- fix/issue-102-login-redirect (last commit 3h ago)

### ⚠️ Attention
- Branch feat/old-experiment has not been updated in 5 days
- 14 uncommitted changes in src/components/Map.tsx (2h idle)
```

### End of Day Summary

Generated at end of working session:

```markdown
## End of Day — {Date}

### Completed
- Closed #{issue} — fix login redirect loop
- Merged #{PR} — feat(ui): dark mode toggle

### In Progress
- #{issue} — OAuth2 integration (spec written, implementation 40%)

### Tomorrow
- Complete OAuth2 implementation
- Review #{PR} from teammate
```

## Red Flags

- A release with no changelog entry
- A version bump that doesn't match the commit types present
- `CHANGELOG.md` last updated more than 2 releases ago
- A GitHub Release with no description
- PRs open for more than 3 days without review

## Rationalizations

| What you think | What The Herald knows |
|---------------|----------------------|
| "Everyone knows what changed" | Nobody reads commits. People read changelogs. Write the changelog. |
| "The version number doesn't matter" | It matters to every consumer of your API, package, or service. |
| "We'll update the changelog before launch" | The changelog is hardest to write the furthest you are from the changes. Write it as you go. |

## Verification

Before a release:

- [ ] Version bump is correct for the commit types present
- [ ] CHANGELOG.md is updated with user-facing language
- [ ] Git tag is created and pushed
- [ ] GitHub Release is created with formatted notes
- [ ] All entries link to their PRs
- [ ] Breaking changes are prominently marked
