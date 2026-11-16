# ADR-038: Skill Discovery and Execution Caching

**Date:** 2026-11-16
**Status:** Accepted

## Context

Batch F is nine performance issues over one pipeline: scan → parse → catalogue →
activate → run. Each proposes its own cache. Two caches with different keys and
invalidation rules would drift, and a cache that serves a stale skill is worse
than a slow one, because the failure is silent.

Three questions decide the design:

1. **What is safe to cache?** Parsed metadata is derived from a file we can stat;
   a script's output is not derived from anything we control.
2. **Who invalidates it?** The filesystem, or the user.
3. **What does a hit mean?** Served despite a change we did not see.

## Decision

### 1. One metadata cache, stat-invalidated

`src/skills/discovery/manifestCache.ts` keeps one JSON file per project at
`.agenthood/skill-cache/metadata.json`, keyed by the SKILL.md path and validated
by `mtimeMs` + `size`. A hit skips the file read, the YAML parse, the injection
scan and the spec-shape checks; the cached entry carries their results. A miss
parses and rewrites the entry. Entries not seen in a run are dropped, so the file
does not grow across deleted skills.

`mtimeMs` + `size` misses a rewrite that restores the original mtime — the
single case the cache can serve stale content. `agenthood cache clear` covers an
intentional disguise, and `agenthood verify` reads the file directly and is
unaffected.

### 2. The scan is bounded, and the bound is visible

Scanning keeps the 6-level depth limit and adds a 2000-directory cap, with
`.venv`, `__pycache__`, `.tox`, `vendor` and `target` alongside the existing
skips. Once the cap is hit, the scan stops and says so — a partially scanned
skill set that looks complete is the failure mode worth avoiding.

`.gitignore` is **not** parsed. A correct matcher is a dependency (`ignore`),
and a partial matcher silently hides skills. The ignore list above covers the
directories that actually appear.

Scan stats (directories, skills, cache hits, duration) are recorded per
discovery and shown by `agenthood skills --stats`, so the benchmark is a
measurement, not a claim.

### 3. Script output caching is opt-in

`skills.cacheOutputs: true` (default `false`) caches the result of a
`run_skill_script` call at `.agenthood/skill-cache/output/<sha256>.json` for
`skills.cacheTtlMs` (default 3600000). The key is the skill name, the script
path, the arguments and a digest of the script file — an edited script is never
served from cache. One-off commands are never cached: their side effects live
outside the run.

It is opt-in because a bundled script may mutate the workspace, and serving a
cached result would silently skip that mutation. A cache hit is stated in the
tool output, never implied.

### 4. Activation is deduplicated, content protected, and resumable

- A second `activate_skill` for a skill already active in the run returns a
  short pointer, not the body again (#533). `{ "force": true }` reloads it.
  The block stays in the transcript: `ContextCompressor` protects skill turns.
- When protected compression runs, one log line records that skill content was
  preserved while other turns were summarised (#532).
- Activated skill names are already checkpointed per step; on resume they are
  restored into both the ReAct loop's scope and the activation tool's run set,
  so `run_skill_script` keeps its authorization and the skill's tool scope
  survives an interrupted run or a provider failover (#618).

### 5. No import-based lazy loading

`#614` asked for lazy loading with `import()`. Skills are data files, not
modules: the catalogue needs name and description for every skill, and the body
is one `readFileSync` that the metadata cache already avoids on later runs. A
lazy body split would turn `ISkillManifest.body` into a promise across every
call site to save one read that the cache makes unnecessary. The measured
number is the deliverable, not the mechanism.

## Consequences

- `agenthood cache clear` removes the metadata cache, the output cache and
  spilled script output; `agenthood cache stats` reports entries and hit rates.
- `agenthood verify --tokens` warns over a 5000-token body (`token-budget` in
  frontmatter overrides) and reports the total; `--dedup` reports the same skill
  name in several roots with the consolidation suggestion.
- Cross-location duplicates keep the existing runtime rule (project beats user,
  earlier root beats later). `verify --dedup` reports; it does not move files.
- Tests cover the cache as a pure key/validation unit plus one integration run
  through `SkillDiscovery`.
- Measured with `npm run bench:skills` (50 generated project skills, Windows
  dev machine): cold 171 ms, warm 59 ms — a 66% reduction, 111 cache hits. The
  gate fails cold discovery above 500 ms. `#614`'s >50% criterion is met by the
  cache; `import()` lazy loading remains rejected.

## Alternatives considered

| Option | Rejected because |
|---|---|
| Cache bodies in the catalogue, keyed by name only | A renamed or edited skill would be served stale |
| Parse `.gitignore` with a hand-rolled matcher | Silent hiding of skills; a dependency is the honest fix |
| Output caching on by default | A mutating script would silently stop mutating |
| Lazy `import()` for skill bodies | Data files, not modules; the cache removes the read instead |
| fs.watch for invalidation | A watcher misses changes before it starts, and costs more than a stat |
