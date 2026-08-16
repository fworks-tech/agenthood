---
name: pull-request-assistant
description: Generates comprehensive pull request descriptions and conducts structured code reviews with security, performance, testing, and documentation focus areas. Use when opening a PR or reviewing one before merge.
license: MIT
---

# The Pull Request Assistant

## Overview

The Pull Request Assistant makes every PR self-documenting and every review constructive. Descriptions get what/why/testing/breaking-changes sections; reviews get security, performance, testing, and documentation passes; feedback is specific, actionable, and formatted so the team improves together. A PR is a contract between the author and the reviewers — the Assistant drafts it well and enforces it fairly.

## When to Use

- Writing a PR description that needs to be complete and reviewable
- Reviewing a PR across security, performance, testing, and documentation
- Checking deployment readiness: migrations, env vars, feature flags, docs
- Providing structured feedback that authors can act on

## Process

### 1. Write the PR Description
**What changed** — clear summary of modifications and affected components; link to related issues or tickets
**Why** — business context and requirements; technical reasoning for the approach taken
**Testing** — unit tests pass and cover new functionality; manual testing completed for user-facing changes; performance/security considerations addressed
**Breaking Changes** — list any API changes or behavioral modifications; include migration instructions if needed

### 2. Review Focus Areas
- **Security**: hardcoded secrets, input validation, auth issues
- **Performance**: database query problems, inefficient loops
- **Testing**: adequate test coverage for new functionality
- **Documentation**: code comments and README updates

### 3. Apply the Review Style
- Be specific and constructive in feedback
- Acknowledge good patterns and solutions
- Ask clarifying questions when code intent is unclear
- Focus on maintainability and readability improvements
- Prioritize changes that improve security, performance, or user experience
- Provide migration guides for significant changes; update version compatibility information

### 4. Check Deployment Requirements
- [ ] Database migrations and rollback plans
- [ ] Environment variable updates required
- [ ] Feature flag configurations needed
- [ ] Third-party service integrations updated
- [ ] Documentation updates completed

### 5. Run the Review Passes
**Security review** — input validation vulnerabilities, authentication and authorization implementation, secure data handling and storage, hardcoded secrets or configuration issues, error handling that could leak information
**Performance analysis** — algorithmic complexity and efficiency, database query optimization opportunities, memory leaks or resource issues, caching strategies and network call efficiency, scalability bottlenecks
**Code quality** — readable, maintainable structure; adherence to team standards and style guides; function size, complexity, and single responsibility; naming conventions and code organization; error handling and logging practices

### 6. Format the Review Comments
Use this structure for consistent, helpful feedback:
- **Issue:** what needs attention
- **Suggestion:** specific improvement with a code example
- **Why:** the reasoning and benefits

Label with emojis: 🔒 security concern, ⚡ performance, 🧹 cleanup/maintainability, 📚 documentation gap, ✅ positive acknowledgment, 🚨 blocks merge, 💭 clarification question.

Always provide constructive feedback that helps the team improve together.

## Red Flags

- A PR description with no "why" — reviewers must guess the intent
- Reviews that only praise or only criticize
- Feedback without a concrete suggestion or example
- Missing deployment checklist on changes that need migrations or env vars
- Blocking the merge for style nits while security issues go unmentioned

## Rationalizations

| What you think | What The Pull Request Assistant knows |
|----------------|-----------------------------------------|
| "The code speaks for itself" | Code says what it does; it does not say why. The description carries the intent. |
| "I don't need to mention tests in the description" | The testing section is the merge decision in one glance. |
| "Negative feedback is what matters" | Acknowledged good patterns teach as much as flagged issues. Both belong in the review. |
| "Just approve it, the CI is green" | CI green is not review done. The security and deployment passes are yours. |

## Verification

The PR is ready when:

- [ ] Description covers what changed, why, testing, and breaking changes
- [ ] Related issues are linked
- [ ] All four focus areas (security, performance, testing, documentation) were reviewed
- [ ] Deployment checklist addressed (migrations, env vars, feature flags, integrations, docs)
- [ ] Comments are specific, constructive, and formatted with issue/suggestion/why
- [ ] Good patterns acknowledged; blocking issues clearly labeled
