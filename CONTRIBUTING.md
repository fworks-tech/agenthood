## Contributing to Agenthood

### Prerequisites

- Node.js >= 22.14.0
- npm >= 10

### Setup

```bash
git clone https://github.com/fworks-tech/agenthood.git
cd agenthood
npm install
```

The postinstall script is a no-op unless `AGENTHOOD_AUTO_SETUP=1` is set. CI always runs `npm ci --ignore-scripts`.

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
- `.githooks/pre-push` — blocks pushes to `main` and requires `type/issue-NUMBER-...` branch names; the issue-existence check is advisory only
- CI re-validates the same rules in the PR workflow (`docs/conventions/commitlint.config.ts`)

### Pull Requests

- Target the `main` branch for feature branches
- PR title follows the same Conventional Commits format
- Include Closes/Fixes in the description
- All CI checks must pass before merge

### Secrets and Credentials

- Do NOT commit API keys, secrets, or credentials to the repository.
- Set `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY` in your shell profile or CI secrets — never in code.
- Add runtime secrets to your CI provider (GitHub Actions secrets, GitLab CI variables, etc.).
- See AGENTS.md for provider setup instructions.
- If a secret is accidentally committed, rotate/revoke it immediately and coordinate a history purge if needed.

### Line Endings

This repository enforces LF line endings via `.gitattributes`. Keep your editor configured for LF to avoid noisy diffs.
