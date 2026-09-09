## Contributing to Agenthood

### Prerequisites

- Node.js >= 22.14.0 (see `package.json` `engines`; CI pins Node 24 via `.github/actions/setup-env/`)
- npm >= 10

### Setup

```bash
git clone https://github.com/fworks-tech/agenthood.git
cd agenthood
npm install
```

The postinstall script is a no-op unless `AGENTHOOD_AUTO_SETUP=1` is set. CI always runs `npm ci --ignore-scripts`.

### Dependencies

Production dependencies are exact-pinned (`0.105.0`, not `^`) so installs are
reproducible from the lockfile. `@lancedb/lancedb` and `tree-sitter` fetch
native binaries at install time; CI installs with `npm ci --ignore-scripts`, so
no install-time code executes on runners. The Auditor dependency gate
(`.github/scripts/audit-check.sh`) fails on any open vulnerability in production
dependencies and on high/critical ones in the dev scope.

### Build

```bash
npm run build
```

### Test

Run the full non-vscode test suite:

```bash
npm test
```

(vscode-extension tests are excluded via `vitest.config.ts` — they run inside a real VS Code instance with `cd vscode-extension && npm test`.)

Run a specific test file:

```bash
npx vitest run tests/unit/llm/ProviderFailover.test.ts
```

Run with coverage (the same thresholds CI enforces):

```bash
npm run test:coverage
```

A full run must stay above the coverage floor set in `vitest.config.ts`
(`test.coverage.thresholds`) — the `The Tester — Coverage Thresholds` job fails
below it. When you add tests and coverage rises, ratchet the floor **up** toward
the new number so it only ever tightens; never lower it to make a run pass.
Codecov receives the report (`coverage/lcov.info`) but is non-blocking — the
thresholds step is the gate.

### CLI commands

Commands are auto-registered: each file in `src/commands/` exports a `command: CommandDescriptor` (`name`, optional `aliases`, `description`, `handler(args)`). Adding a command means adding a file with a descriptor — `src/cli.ts` never changes. Helper modules in that directory simply export no descriptor. See `src/commands/types.ts`.

### TypeScript

Verify zero type errors before committing:

```bash
npx tsc --noEmit
```

### Shared utilities

- `SkillParser.parseRaw(content)` — shared frontmatter parser used by `SkillParser.parse()` and `verify.ts`.

### Commit Process

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope)!: subject

- type: feat, fix, docs, test, refactor, ci, chore, revert
- scope: area of change (e.g., failover, cli, docs)
- !: mark breaking changes (feat!: ... or feat(scope)!: ...)
- subject: imperative, lowercase, <=150 chars, no trailing period
```

Hooks are installed by `npx agenthood init` and enforce the format automatically:
- `.githooks/commit-msg` — local validation (types, breaking-change `!`, subject rules); stock `git revert` messages pass through
- `.githooks/pre-commit` — blocks commits to main, audits secrets, checks file sizes
- `.githooks/pre-push` — blocks pushes to `main` and requires `type/issue-NUMBER-...` branch names; the issue-existence check is advisory only
- `.githooks/prepare-commit-msg` — installs the commit message template
- CI re-validates the same rules in the PR workflow (`docs/conventions/commitlint.config.ts`)

### Pull Requests

- Target the `main` branch for feature branches
- PR title follows the same Conventional Commits format
- Include `Closes #N` / `Fixes #N` in the description — mandatory. GitHub auto-closes the issue only when the footer is present; the PR workflow enforces it (`.github/scripts/pr-body-check.sh`)
- All CI checks must pass before merge

### CLI Commands

The `agenthood` CLI auto-discovers commands from `src/commands/` — each file exports a `command` descriptor. Key commands:

- `agenthood run <member> "<task>"` — invoke a member or core agent. Runs exit with code 1 on failure (via `process.exitCode`, so piped stderr is not truncated); the error is logged by the command, not the library — library callers calling `ApplicationContext.runMember`/`runAgent` receive the thrown error instead of a process exit.
  - A `--` separator ends flag parsing, so a task beginning with `-` is always treated as data (the opencode plugin passes it).
  - `--resume <id>` resumes from a checkpoint saved during a previous interrupted run.
  - `--debug` dumps raw LLM request/response payloads to `.agenthood/debug/` (keys redacted).
  - `--interactive` enables human-in-the-loop confirmation prompts before tool execution.
- `agenthood checkpoints` — list past run checkpoints (`--json`, `--prune` to remove old ones)
- `agenthood trace` — list recent invocation traces (`--member`, `--limit`, `--since`, `--json`); subcommands: `visualize <id>` (ASCII timeline), `diff <id1> <id2>` (side-by-side comparison)
- `agenthood log` — list recent structured log entries (`--level`, `--member`, `--limit`, `--since`, `--json`, `--tail N`, `--follow`)
- `agenthood status` — project health and member metrics (`--watch`, `--json`, `--drift`, `--member`, `--learner`)
- `agenthood eval <member> --suite <path>` — run an eval suite against a member (`--baseline`, `--update-baseline`, `--benchmark <path>`, `--triggers <path>`, `--convergence`, `--history`, `--ab <member>`, `--json`)
- `agenthood eval --triggers <path>` — score a member's activation trigger rate from a should-/should-not-trigger query set (`--semantic` to also score the embedding surface)
- `agenthood optimize <member> --triggers <path>` — optimize a member description for trigger accuracy (`--apply`, `--iterations`, `--variants`, `--json`)
- `agenthood health` — runtime health checks (`--json`; exit 0 healthy / 1 degraded / 2 unhealthy)
- `agenthood check` / `verify` — health and member-integrity validation
- `agenthood install <url>` — install a skill from a URL or git repository (`--dry-run` to preview)
- `agenthood publish` — publish skills to GitHub for skills.sh indexing (`--dry-run` to preview)
- `agenthood mcp` — start an MCP server on stdio, exposing skills as MCP tools for external agents (Claude Code, Cursor, etc.)
- `agenthood completion` — generate shell tab-completion scripts for bash, zsh, or fish
- `agenthood search <query>` — search for skills in the agenthood registry (`--json`)
- `agenthood upgrade [skill]` — upgrade installed skills to latest version from registry

Adding a command means adding a file in `src/commands/` and documenting it here.

### Observability

Every member invocation emits a trace envelope (member, duration, tokens, cost, quality, status, correlation id). Traces are flushed to `.agenthood/traces/traces.ndjson`; `agenthood status --member <name>` aggregates them into per-member cost/quality summaries over 1h/24h/7d/all windows, and `agenthood trace` lists recent envelopes. Structured log entries written through the `Logger` API (`src/core/Logger.ts`) share the same NDJSON store and retention policy — they are `TraceEnvelope`s with `entryType: "log"` plus a `level` (debug/info/warn/error) and `message`; `agenthood log` lists them and `--level` filters by severity. `message`/`metadata` are redacted at write time through the same `observability.redaction` rules as trace payloads, and `trace`, `status`, `health`, and eval replay ignore log entries. Costs come from the static pricing table in `src/core/modelPricing.ts` (unknown models fall back with a warning).

Evaluation: `agenthood eval <member> --suite <path>` runs the member against every task in an eval suite (`evals/benchmarks/` ships ready-made fixtures), scores each run on faithfulness, relevance, context_recall, and answer_correctness via an LLM judge, and compares the aggregates against a stored baseline in `.agenthood/baselines/<member>.json` — the command exits non-zero when a metric regresses. Use `--update-baseline` after a deliberately good run to refresh the comparison target.

A task can also declare deterministic `assertions` in the suite JSON — `{ type: "exact" | "contains" | "regex" | "semantic", target, weight?, flags?, threshold? }` (schema in `src/evals/evalSuiteSchema.ts`, graded by `src/evals/AssertionJudge.ts`). `exact`/`contains`/`regex` need no LLM and run key-free in CI; `semantic` compares output to target by embedding cosine similarity (passing at `threshold`, default 0.8). Per task the assertions collapse into an `assertions` score (a weight-normalised partial-credit mean in `[0,1]`) shown as the `Assert` column and folded into the aggregate. Prefer assertions for anything with a checkable shape and reserve LLM-judged metrics for open-ended quality.

`--benchmark <path>` writes a standardized `benchmark.json` (built by `src/evals/benchmark.ts`) alongside the run: `pass_rate`, `avg_time_ms`, and `avg_tokens` plus the per-metric `aggregate` and a per-task outcome list. A task is *passed* when its assertions are all green, else when the mean of its judge scores is at or above `0.7`; errored tasks are counted in `errorCount` and excluded from the pass-rate denominator. Token totals come from the member run's `usage`, so the same figures feed cost and provider comparisons (`--provider`-style selection is a run-time config concern — record `provider`/`model` in the benchmark to compare configurations across runs).

Every suite-based eval auto-records to an append-only JSONL history at `.agenthood/evals/history/<member>.jsonl` (one line per run: version, timestamp, pass rate, aggregates). `--convergence` reports whether the last 5 runs have stabilized (variance below 0.02 over at least 3 runs) and flags any drop against the best-seen pass rate. `--history` prints the full recorded run table for the member. Trigger-rate and replay evaluations do not record history.

Blind A/B comparison (issue #558) runs two members against the same suite and scores each task's outputs independently on clarity, completeness, and accuracy. A paired t-test across per-task deltas determines whether the observed difference is statistically significant (p < 0.05) and reports Cohen's d for effect size. `agenthood eval <memberA> --ab <memberB> --suite <path>` prints a per-task comparison table, aggregate scores, winner, and significance. Exits 1 when B wins (CI-gateable regression check).

Trigger-rate testing (issue #557) measures how reliably a member is *activated*, separate from how well it performs once running. `agenthood eval --triggers <path>` loads a query set (`evals/triggers/<member>.json`: `{ member, shouldTrigger[], shouldNotTrigger[] }`, schema in `src/evals/trigger.ts`) and reports precision/recall/accuracy/F1 per surface. The **keyword** surface runs the runtime's `MemberOrchestrator` router — deterministic, key-free, safe in CI. The **semantic** surface (`--semantic`, needs a provider) embeds every member description and picks the closest match, approximating how an external loader selects a skill by its SKILL.md description. Results are ranked best-F1 first, a train/validation split guards against over-fitting a description to its own tuning queries, and low precision/recall produce concrete "narrow/broaden the description" recommendations. This harness is the measurement foundation `agenthood optimize` (#584) iterates against.

Description optimization (issue #584) closes the loop: it uses the trigger-rate harness as a scoring function and iterates an LLM-driven generate/score loop to find a description that maximizes F1. `agenthood optimize <member> --triggers <path>` loads the query set, scores the current description, generates variants via LLM, scores each against a held-out validation split, and keeps the best. It stops when F1 plateaus (improvement < 0.02) or after `--iterations` (default 3). Without `--apply` it prints the winning description; with `--apply` it writes it to `src/members/member-specs.ts`. `--json` outputs machine-readable results.

Redaction: trace payload text is scrubbed before persistence by default. Emails, `sk-` keys, bearer tokens, URL query values, and IP addresses are replaced with a deterministic `[REDACTED]` placeholder (preserving replay reproducibility). Custom regex rules and absolute-path roots are opt-in via `{ "observability": { "redaction": { "rules": ["<regex sources>"], "paths": ["<file roots>"] } } }` in `.agenthood/config.json`; set `"enabled": false` to disable redaction entirely.

Retention: `{ "observability": { "retention": { "ttlDays": 30, "maxEntries": 100000, "exportEnabled": true, "exportPath": "./traces/export" } } }` bounds the trace store — traces older than `ttlDays` and beyond `maxEntries` (oldest first) are pruned hourly, and pruned data is exported to NDJSON before deletion when `exportEnabled` is set. `ttlDays: 0` disables pruning.

Alerts: `{ "observability": { "alerts": { "costThreshold": 3, "qualityDrop": 0.2, "burstThreshold": 10, "cooldownMinutes": 60, "viralPersonaMarkers": 2, "propagationCopies": 3 } } }` tunes anomaly detection. On every trace flush the detector scores the batch against per-member leave-one-out baselines and appends cost spikes, quality drops, bursts, and — for mind-virus defense (see ADR-020) — `viral_persona` (recurring consciousness/persistence/resonance theme markers) and `propagation` (a viral core token replicated across many distinct sessions) to `.agenthood/alerts/anomalies.ndjson`, surfaced by `agenthood status --alerts`. All thresholds default to the values above when the block is absent.

Trace path: `{ "observability": { "tracePath": ".agenthood/traces/traces.ndjson" } }` relocates the trace store (relative paths resolve against the project root); the runtime, `trace`, `log`, `status`, and `health` commands all honor it.

Mind-virus hardening: `{ "security": { "strictSkillIntegrity": false } }` controls the injection-time integrity check that hashes each member's injected `SKILL.md` against `agenthood.lock` when its system prompt is assembled (see ADR-020). Drift is recorded durably into decision/provenance stores and warns by default; set `strictSkillIntegrity` to `true` to block the run instead (after the audit entry is recorded). A **corrupt** lockfile (unreadable/invalid JSON) is treated like drift — it warns and records, and blocks under strict mode. A **missing lockfile entry** — or a wholly absent `agenthood.lock`, or a missing skill file — is no longer silent: it warns, records a durable audit entry, and also blocks under strict mode, so an operator always sees when the integrity gate is off.

Skill lockfile lifecycle: `agenthood.lock` records the content hash of each member's `SKILL.md` so tampering and drift are detectable (see ADR-020). Plain `agenthood verify` **detects** drift and fails — it is the integrity gate, and CI runs `agenthood verify --strict` so a `SKILL.md` edit committed without a matching lock re-entry goes red. After an intentional edit, `agenthood verify --update-lock` **re-locks** the changed members. The update merges into the existing lock (a `verify <member> --update-lock` run never drops the other members), keeps each unchanged member's `updatedAt` so a one-skill edit produces a one-line diff, and writes keys in sorted order for byte-stable output — this is what stops the file generating merge conflicts on every concurrent branch. Commit the regenerated lock alongside the skill change.

Replay evaluation: `agenthood eval <member> --replay [--limit N]` re-runs stored envelopes against their inputs and reports output drift via embedding similarity to `.agenthood/evals/replay-report.json`; re-run outputs pass through the redactor.

Redaction scope: the redactor also guards decision (`task`/`decision`) and provenance (`sourceDocument`) payloads, and trace hashes are computed over the redacted text so `inputHash` matches the persisted payload (see [ADR-018](docs/adr/ADR-018-redaction-scope-for-decisions.md)).

Error reporting: setting `{ "sentry": { "dsn": "https://..." } }` in `.agenthood/config.json` sends member run failures to Sentry (member, model, status, duration, correlation id). The integration is dynamically imported and never loaded when the DSN is absent. Never commit a real DSN to the repository.

### Secrets and Credentials

- Do NOT commit API keys, secrets, or credentials to the repository.
- Set `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY` in your shell profile or CI secrets — never in code.
- Add runtime secrets to your CI provider (GitHub Actions secrets, GitLab CI variables, etc.).
- See AGENTS.md for provider setup instructions.
- If a secret is accidentally committed, rotate/revoke it immediately and coordinate a history purge if needed.

### Line Endings

This repository enforces LF line endings via `.gitattributes`. Keep your editor configured for LF to avoid noisy diffs.
