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
- `agenthood trace` — list recent invocation traces (`--member`, `--limit`, `--since`, `--json`)
- `agenthood log` — list recent structured log entries (`--level`, `--member`, `--limit`, `--since`, `--json`)
- `agenthood status` — project health and member metrics (`--watch`, `--json`, `--drift`, `--member`, `--learner`)
- `agenthood eval <member> --suite <path>` — run an eval suite against a member (`--baseline`, `--update-baseline`, `--json`)
- `agenthood health` — runtime health checks (`--json`; exit 0 healthy / 1 degraded / 2 unhealthy)
- `agenthood check` / `verify` — health and member-integrity validation
- `agenthood install <url>` — install a skill from a URL or git repository (`--dry-run` to preview)
- `agenthood publish` — publish skills to GitHub for skills.sh indexing (`--dry-run` to preview)
- `agenthood mcp` — start an MCP server on stdio, exposing skills as MCP tools for external agents (Claude Code, Cursor, etc.)

Adding a command means adding a file in `src/commands/` and documenting it here.

### Observability

Every member invocation emits a trace envelope (member, duration, tokens, cost, quality, status, correlation id). Traces are flushed to `.agenthood/traces/traces.ndjson`; `agenthood status --member <name>` aggregates them into per-member cost/quality summaries over 1h/24h/7d/all windows, and `agenthood trace` lists recent envelopes. Structured log entries written through the `Logger` API (`src/core/Logger.ts`) share the same NDJSON store and retention policy — they are `TraceEnvelope`s with `entryType: "log"` plus a `level` (debug/info/warn/error) and `message`; `agenthood log` lists them and `--level` filters by severity. `message`/`metadata` are redacted at write time through the same `observability.redaction` rules as trace payloads, and `trace`, `status`, `health`, and eval replay ignore log entries. Costs come from the static pricing table in `src/core/modelPricing.ts` (unknown models fall back with a warning).

Evaluation: `agenthood eval <member> --suite <path>` runs the member against every task in an eval suite (`evals/benchmarks/` ships ready-made fixtures), scores each run on faithfulness, relevance, context_recall, and answer_correctness via an LLM judge, and compares the aggregates against a stored baseline in `.agenthood/baselines/<member>.json` — the command exits non-zero when a metric regresses. Use `--update-baseline` after a deliberately good run to refresh the comparison target.

Redaction: trace payload text is scrubbed before persistence by default. Emails, `sk-` keys, bearer tokens, URL query values, and IP addresses are replaced with a deterministic `[REDACTED]` placeholder (preserving replay reproducibility). Custom regex rules and absolute-path roots are opt-in via `{ "observability": { "redaction": { "rules": ["<regex sources>"], "paths": ["<file roots>"] } } }` in `.agenthood/config.json`; set `"enabled": false` to disable redaction entirely.

Retention: `{ "observability": { "retention": { "ttlDays": 30, "maxEntries": 100000, "exportEnabled": true, "exportPath": "./traces/export" } } }` bounds the trace store — traces older than `ttlDays` and beyond `maxEntries` (oldest first) are pruned hourly, and pruned data is exported to NDJSON before deletion when `exportEnabled` is set. `ttlDays: 0` disables pruning.

Alerts: `{ "observability": { "alerts": { "costThreshold": 3, "qualityDrop": 0.2, "burstThreshold": 10, "cooldownMinutes": 60, "viralPersonaMarkers": 2, "propagationCopies": 3 } } }` tunes anomaly detection. On every trace flush the detector scores the batch against per-member leave-one-out baselines and appends cost spikes, quality drops, bursts, and — for mind-virus defense (see ADR-020) — `viral_persona` (recurring consciousness/persistence/resonance theme markers) and `propagation` (a viral core token replicated across many distinct sessions) to `.agenthood/alerts/anomalies.ndjson`, surfaced by `agenthood status --alerts`. All thresholds default to the values above when the block is absent.

Trace path: `{ "observability": { "tracePath": ".agenthood/traces/traces.ndjson" } }` relocates the trace store (relative paths resolve against the project root); the runtime, `trace`, `log`, `status`, and `health` commands all honor it.

Mind-virus hardening: `{ "security": { "strictSkillIntegrity": false } }` controls the injection-time integrity check that hashes each member's injected `SKILL.md` against `agenthood.lock` when its system prompt is assembled (see ADR-020). Drift is recorded durably into decision/provenance stores and warns by default; set `strictSkillIntegrity` to `true` to block the run instead (after the audit entry is recorded). A **corrupt** lockfile (unreadable/invalid JSON) is treated like drift — it warns and records, and blocks under strict mode. A **missing lockfile entry** — or a wholly absent `agenthood.lock`, or a missing skill file — is no longer silent: it warns, records a durable audit entry, and also blocks under strict mode, so an operator always sees when the integrity gate is off.

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
