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

### Build

```bash
npm run build
```

### Test

Run the full non-vscode test suite:

```bash
npx vitest run --exclude 'vscode-extension/**'
```

Run a specific test file:

```bash
npx vitest run tests/unit/llm/ProviderFailover.test.ts
```

### TypeScript

Verify zero type errors before committing:

```bash
npx tsc --noEmit
```

### Commit Process

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

- type: feat, fix, docs, test, refactor, ci, chore
- scope: area of change (e.g., failover, cli, docs)
- subject: imperative, lowercase, <=150 chars, no trailing period
```

Hooks are installed by `npx agenthood init` and enforce the format automatically.

### Pull Requests

- Target the `v2.0.x` branch for stacked changes
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
