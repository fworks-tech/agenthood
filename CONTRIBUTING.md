## Secrets and Credentials

- Do NOT commit API keys, secrets, or credentials to the repository.
- Use `runtime/.env.example` as a template for required environment variables.
- Add runtime secrets to your CI provider (GitHub Actions secrets, GitLab CI variables, etc.).
- Local development: create a `.env` file from `.env.example` and add `.env` to `.gitignore`.
- If a secret is accidentally committed, rotate/revoke it immediately and coordinate a history purge if needed.

Following these practices helps protect users and prevents automated Auditor hooks from blocking legitimate commits.
