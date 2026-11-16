# ADR-035: Skill Namespaces and `.well-known` Catalog Distribution

**Date:** 2026-11-15
**Status:** Accepted

## Context

Two v4.0 issues ask for distribution features that outgrew the flat local skill model:

- **#593** — registry names conflict. `reviewer` from this repository and a community
  `reviewer` cannot coexist in one registry keyed by bare name. Issue: adopt
  `owner/skill-name`, require a namespace on publish, allow `@owner/name` shortcuts.
- **#522** — `.well-known` discovery. Fetch a skill catalog from a plain HTTPS endpoint
  so a team can publish skills without a git repository.

Neither had a wire format, and the repo has two consumers already written against
assumed-but-undefined shapes: `SkillRegistryClient` (a private HTTP API) and
`RemoteSkillFetcher` (single-file URLs). This ADR is the contract of record. Where the
registry service does not exist yet, the client is built to this ADR and the service is
expected to match it — the alternative is a private standard invented silently in code.

## Decision

### 1. A namespace is a reference, not a rename

A **skill reference** is `owner/name`, optionally written `@owner/name` on the command line.

- `owner` — `^[a-z0-9]+(-[a-z0-9]+)*$`, ASCII only. Registry keys must survive URL
  encoding, case-insensitive filesystems and DNS; unicode belongs in the skill name, not
  the owner segment.
- `name` — the skill's own `name`, unchanged by this ADR.

**The on-disk identity stays flat.** The directory and the frontmatter `name` never
contain a slash. A slash is not a portability-safe directory name, and 45+ clients read
`SKILL.md` verbatim — renaming local skills to `owner/name` would break every one of them.

The owner comes from `metadata.author` (a flat `author` is tolerated for compatibility).
It is optional locally and required to publish. A skill without an author is a private,
unpublished skill; that is the correct default for the majority of installs.

Two skills in one project declaring the same `owner/name` is an error — that is the only
place uniqueness is enforceable without a registry, and it catches the copy-paste case
that produces the conflict in the first place.

### 2. Registry wire contract

The registry API is keyed by reference. Path segments are encoded separately so `/`
remains a separator:

```
GET /api/skills/search?q=…                  (unchanged, flat results carry name + author)
GET /api/skills/{owner}/{name}
GET /api/skills/{owner}/{name}/versions
GET /api/skills/{owner}/{name}/download/{version}
```

A bare `{name}` still resolves, for entries published before namespaces existed. No
migration is required: a bare key and an owned key are different rows, and the client
prefers the qualified one when the lockfile records one.

### 3. `.well-known` catalog wire contract

Endpoint: `https://<host>/.well-known/agentskills`. A base URL in config is completed
with that suffix; a full endpoint URL is used as-is.

Request: `GET`, `Accept: application/json, application/yaml`, optional
`Authorization: Bearer <token>`.

Response — JSON, or the same shape in YAML:

```json
{
  "version": 1,
  "skills": [
    {
      "name": "reviewer",
      "owner": "agenthood",
      "description": "Reviews code across correctness, readability and security.",
      "version": "1.2.0",
      "url": "https://skills.example.com/reviewer/SKILL.md",
      "integrity": "sha256-K7g…",
      "tier": "community",
      "license": "MIT"
    }
  ]
}
```

- `version` (catalog format) must be `1`; an unknown value is rejected, not guessed at.
- `skills[].name` and `skills[].url` are required. `url` must be absolute `https:` and
  passes the same SSRF validation as every other remote fetch.
- `integrity` is `sha256-<base64>` over the SKILL.md bytes. Advisory: it is reported and
  compared when the user installs from the catalog, but a catalog entry alone installs
  nothing — `agenthood install <url>` remains the only write path.
- Unknown fields are ignored, so a catalog can grow without breaking old clients.

### 4. Caching, auth and fallback

- **Cache**: `.agenthood/catalog-cache/<sha256(endpoint)>.json`, holding
  `{ fetchedAt, catalog }`. TTL from `remoteCatalogs.ttlSeconds` (default 86400);
  `--refresh` bypasses it. Cache is keyed by endpoint, so two catalogs never collide.
- **Auth**: `remoteCatalogs.sources[].tokenEnv` names an environment variable. The token
  is read at request time and sent only to that source's origin. Tokens never enter
  config, the cache, or the lockfile — a config checked into git must not carry secrets.
- **Fallback**: an unreachable or invalid catalog is advisory. The command reports the
  failure, serves stale cache when one exists, and exits 0. Catalogs add listings; they
  never replace local discovery, so "remote is down" degrades to "local skills only" by
  construction rather than by a code path that has to remember to be careful.

## Consequences

- `agenthood publish` now requires `metadata.author` and prints `owner/name`; a project
  already publishing without an author gets a clear error naming the missing field.
- `agenthood install @owner/name` resolves through the registry. A bare `name` and a
  path-like argument keep their old URL semantics — only a value that parses as
  `owner/name` switches behavior, so existing scripts do not change meaning.
- `agenthood catalog [url]` is added for listing configured or ad-hoc catalogs.
- Local skill names, directories, `allowed-tools` and the lockfile hash are untouched.
  `metadata.author` is additive; no migration step.
- The registry service must implement §2 before `install @owner/name` works against it.
  Until then the client fails with the registry's error, which is the honest outcome.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Rename local skills to `owner/name` | Breaks every client that reads the directory name; a slash is not a safe dir name |
| Require a namespace on every skill, local included | Punishes the common single-author project to solve a registry problem |
| Put the owner in `metadata.namespace` | A second field for the same fact; `author` already exists in the wild |
| A custom catalog schema with pagination and signatures | Unsigned JSON over HTTPS is honest about its trust level; signatures can be added to `integrity` later |
| Cache with the catalog body's own TTL | Gives the remote server control over local cache lifetime |
