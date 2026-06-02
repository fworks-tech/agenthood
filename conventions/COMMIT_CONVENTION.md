# Commit Convention

The Agenthood follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.
Enforced locally by Husky + commitlint, and in CI by the Doorman workflow.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types

| Type | When to use |
|------|------------|
| `feat` | A new feature for the user |
| `fix` | A bug fix for the user |
| `docs` | Documentation changes only |
| `test` | Adding or correcting tests |
| `refactor` | Code change that is neither a fix nor a feature |
| `ci` | CI/CD pipeline changes |
| `chore` | Build process, dependency updates, config |

## Rules

- **Subject** is imperative, lowercase, ≤50 chars, no trailing period
- **Body** explains *why*, not what — optional but encouraged
- **Footer** links to issues: `Closes #42` or `Fixes #42`
- **Breaking changes** use `!` after type: `feat!: remove legacy auth`

## Examples

```
feat(auth): add OAuth2 login with Google

Replaces the custom session auth to reduce maintenance burden
and align with the platform's SSO requirements.

Closes #88

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```
fix(api): handle null response from geocoding service

Closes #102
```

```
chore(deps): upgrade react to v19
```

## What not to write

```
fix stuff
wip
update
changes
trying something
asdf
```

*The Doorman will reject these. The Society will not apologize.*
