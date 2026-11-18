# Utility Skills

> *Specialist skills for the tasks that none of the 20 members owns.*

The [Skills Reference](skills-reference.md) documents the Society members: the 20 roles the runtime can invoke with `npx agenthood run`. This page documents the utility skills: specialist capability files that any agent runtime loads from `skills/`, ported from the GitHub Copilot customization library and the deepagents project. They have no runtime invocation (they are not registered members); they activate when their `description` matches the task at hand.

---

## Teaching & Explaining

### Concept Explainer

> *Most concepts have a simple core under the jargon.*

**What it does:** Breaks down complex technical concepts in beginner-friendly ways: everyday analogies first, terminology second, working examples always, with comprehension checks before moving on.

**When to use:** Explaining a technical topic to a learner, onboarding someone into unfamiliar code, writing educational documentation, answering "why does this work" with more than a one-liner.

**File:** [`skills/concept-explainer/SKILL.md`](../../skills/concept-explainer/SKILL.md)
**Relation:** Complements The Librarian (documentation): the Explainer teaches, the Librarian records.

### Onboarding Planner

> *Foundation, exploration, integration: a path from first day to first contribution.*

**What it does:** Creates personalized phased onboarding plans: environment setup with troubleshooting, codebase discovery with beginner-friendly first tasks, and team-process integration through early wins.

**When to use:** A new team member joins, a developer arrives with an unfamiliar stack, or onboarding documentation needs structure.

**File:** [`skills/onboarding-plan/SKILL.md`](../../skills/onboarding-plan/SKILL.md)
**Relation:** Complements The Librarian (docs) and The Concept Explainer (learning material).

---

## Planning & Building

### Cleanup Specialist

> *Simplifies safely. Nothing observable changes.*

**What it does:** Removes dead code, consolidates duplication, simplifies messy patterns, and applies consistent formatting across code and documentation: one improvement at a time, tested before and after, never adding features.

**When to use:** A file, directory, or codebase has accumulated dead code or duplication and needs maintainability work without behavior change.

**File:** [`skills/cleanup-specialist/SKILL.md`](../../skills/cleanup-specialist/SKILL.md)
**Relation:** Complements The Warden (detects smells): the Warden reports, the Specialist remediates.

---

## GitHub Workflow

### Issue Manager

> *An issue that requires a follow-up conversation to understand has failed.*

**What it does:** Turns vague complaints into workable tickets: bug report essentials (reproduction steps, expected vs actual, environment), structured feature requests (problem, use cases, success criteria), and triage best practices (labels, linking, clarifying questions).

**When to use:** Filing bug reports or feature requests, triaging an issue queue, or teaching contributors to write actionable issues.

**File:** [`skills/issue-manager/SKILL.md`](../../skills/issue-manager/SKILL.md)
**Relation:** Complements The Doorman (standards enforcement) and The Scribe (communication): no lane overlap.

---

## Quality

### Accessibility Auditor

> *A page that only works with a mouse is a page that does not work.*

**What it does:** Audits web interfaces against WCAG: semantic HTML first, ARIA requirements, keyboard navigation with visible focus, contrast ratios (4.5:1 text / 3:1 large text and UI), screen reader compatibility, accessible forms, and automated plus manual testing integration.

**When to use:** Generating or reviewing HTML, auditing an interface against accessibility standards, or designing forms and dynamic content.

**File:** [`skills/accessibility-auditor/SKILL.md`](../../skills/accessibility-auditor/SKILL.md)
**Relation:** Complements The Auditor (security): a specialized, WCAG-focused review lane.

---

## Memory

### Rememberer

> *Preferences in memory, processes in skills. Unclassified knowledge is unfindable knowledge.*

**What it does:** Scans conversation history, classifies learnings (best practices, anti-patterns, conventions, decision rationale) into memory entries for guidelines or skill files for reusable workflows, and summarizes what was captured and where.

**When to use:** "Remember this", "save what we learned", "update memory", or "capture learnings": any session that produced knowledge worth keeping.

**File:** [`skills/remember/SKILL.md`](../../skills/remember/SKILL.md)
**Relation:** Complements The Librarian (knowledge management): the Rememberer captures from sessions, the Librarian curates the corpus.

---

## Infrastructure & Integrations

### AWS

> *The cloud is one command away. Knowing which command is the work.*

**What it does:** Wraps the `aws` CLI for S3 listing, copy and sync, EC2 instance listing, start and stop, and Lambda listing and invocation. Reads the default profile from `~/.aws/config` unless `AWS_PROFILE` is set.

**When to use:** Managing S3, EC2, Lambda or other AWS services from the terminal.

**File:** [`skills/aws/SKILL.md`](../../skills/aws/SKILL.md)

### Docker

> *A container that runs on your machine is not yet a container that runs anywhere.*

**What it does:** Images (list, pull, build, remove), containers (run, stop, list), Compose, and cleanup commands. Notes that the daemon must be running and that `--rm` removes a container on exit.

**When to use:** Building, running, or debugging containers.

**File:** [`skills/docker/SKILL.md`](../../skills/docker/SKILL.md)
**Relation:** The Operator deploys and watches the running system; this skill supplies the container commands it works through.

### Kubernetes

> *The pod is the smallest thing you can inspect. The deployment is the thing that matters.*

**What it does:** `kubectl` commands for pods (list, describe, logs, exec), deployments (list, scale, rollout status, rollback), services, and contexts. Namespace targeting uses `-n`.

**When to use:** Deploying, inspecting, or debugging Kubernetes resources.

**File:** [`skills/kubernetes/SKILL.md`](../../skills/kubernetes/SKILL.md)

### Datadog

> *A metric nobody queries is a metric nobody has.*

**What it does:** Datadog HTTP API calls for metrics, monitors, and logs, authenticated with `DD_API_KEY`. The EU site uses `api.datadoghq.eu` instead of `api.datadoghq.com`.

**When to use:** Querying metrics or logs, or managing monitors.

**File:** [`skills/datadog/SKILL.md`](../../skills/datadog/SKILL.md)

### Sentry

> *The stack trace is the beginning of the question, not the answer.*

**What it does:** Uses the hosted Sentry MCP for triage (find organizations and projects, search issues sorted by impact, fetch issue details) and `sentry-cli` for releases and source maps. Escalation to Seer follows the criteria in `docs/portals/sentry.md`.

**When to use:** Triaging production errors or managing releases.

**File:** [`skills/sentry/SKILL.md`](../../skills/sentry/SKILL.md)
**Relation:** The Debugger maps its five-step protocol onto these tools; setup lives in `docs/portals/sentry.md`.

### Elasticsearch

> *Full text search is a query problem before it is a cluster problem.*

**What it does:** Elasticsearch REST calls for cluster state, search, and index management on the default port 9200. `?pretty` formats JSON and `/_cat/` endpoints give human-readable output.

**When to use:** Querying, indexing, or managing Elasticsearch indices.

**File:** [`skills/elasticsearch/SKILL.md`](../../skills/elasticsearch/SKILL.md)

### MongoDB

> *Inspect before you query. The schema is whatever the documents say it is.*

**What it does:** `mongosh` commands for connection, database and collection inspection, and queries. Notes that `mongosh` replaces the deprecated `mongo` shell, and gives the connection string format.

**When to use:** Querying, inspecting, or managing MongoDB collections.

**File:** [`skills/mongodb/SKILL.md`](../../skills/mongodb/SKILL.md)

### MySQL

> *Credentials belong in a config file, not in a shell history.*

**What it does:** `mysql` commands for connection, schema inspection, and operations, with credentials stored in `~/.my.cnf` rather than passed on the command line.

**When to use:** Querying, inspecting schema, or managing MySQL databases.

**File:** [`skills/mysql/SKILL.md`](../../skills/mysql/SKILL.md)

### PostgreSQL

> *`\d` answers in one line what a schema dump answers in a hundred.*

**What it does:** `psql` commands for connection through `DATABASE_URL`, inspection (`\l`, `\dt`, `\d`, `\dn`), and one-shot queries with `-c`.

**When to use:** Querying, inspecting schema, or managing PostgreSQL databases.

**File:** [`skills/postgres/SKILL.md`](../../skills/postgres/SKILL.md)

### Redis

> *`KEYS *` is a production incident waiting for a large keyspace.*

**What it does:** `redis-cli` commands for connection, authentication, key operations (get, set, delete, exists, set with expiry), and inspection. Warns that `KEYS *` blocks and `SCAN` is the alternative for large datasets.

**When to use:** Interacting with Redis caches, queues, or key-value stores.

**File:** [`skills/redis/SKILL.md`](../../skills/redis/SKILL.md)

### GitHub

> *The API is the interface. The browser is a convenience.*

**What it does:** `gh` commands for issues, pull requests (list, view, create, checkout), repositories, and releases. Authentication comes from `gh auth login`, and `--json` gives machine-readable output.

**When to use:** Working with issues, PRs, releases, or repository settings.

**File:** [`skills/github/SKILL.md`](../../skills/github/SKILL.md)
**Relation:** The Scribe writes the PR descriptions and The Doorman validates PR standards; the API calls are this skill's.

### GitLab

> *Merge requests, pipelines and issues share one CLI.*

**What it does:** `glab` commands for merge requests (list, view, create, merge, approve), issues, CI/CD pipelines, and repositories. Authentication comes from `glab auth login`.

**When to use:** Working with merge requests, issues, or CI/CD pipelines.

**File:** [`skills/gitlab/SKILL.md`](../../skills/gitlab/SKILL.md)

### Jira

> *A sprint you cannot query is a sprint you cannot plan.*

**What it does:** `jira-cli` commands for issues (view, create, update), sprints, and search. The API token comes from Atlassian, and config lives in `~/.jira/.config.yml`.

**When to use:** Viewing, creating, or updating Jira issues.

**File:** [`skills/jira/SKILL.md`](../../skills/jira/SKILL.md)

### Linear

> *The issue tracker is only useful when the terminal can reach it.*

**What it does:** Linear CLI commands for issues, teams and projects, and search, with authentication through `linear auth`.

**When to use:** Viewing, creating, or updating Linear tasks.

**File:** [`skills/linear/SKILL.md`](../../skills/linear/SKILL.md)

### Email

> *A notification nobody receives is a notification that did not happen.*

**What it does:** Sends mail through `sendmail` or `msmtp`, or over SMTP with `curl` and a message file that carries the headers. Notes that msmtp reads `~/.msmtprc` and that SMTP credentials never belong in a script.

**When to use:** Sending transactional emails or notifications programmatically.

**File:** [`skills/email/SKILL.md`](../../skills/email/SKILL.md)

### Telegram

> *A bot token and a chat id are the whole setup.*

**What it does:** Telegram Bot API calls for sending messages, with optional Markdown formatting, plus `getUpdates` and `getMe`. Uses `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

**When to use:** Sending notifications or building chat interactions.

**File:** [`skills/telegram/SKILL.md`](../../skills/telegram/SKILL.md)

### Web Research

> *An answer without a trail is a rumour with better formatting.*

**What it does:** Turns a question into a plan of 3 to 5 subtopics, gives each subtopic its own parallel search agent with an expected source type, saves findings with URLs and dates under `research/`, and synthesises one cited report with the answer, numbered findings, disagreements, and gaps. It records a claim as unverified rather than dropping it.

**When to use:** A question depends on sources outside the repository, needs several independent angles, or will be acted on by someone who must check the evidence afterwards.

**File:** [`skills/web-research/SKILL.md`](../../skills/web-research/SKILL.md)

---

## Related

- [Skills Reference](skills-reference.md): the 20 Society members and their invocation
- [Built-in Tools](../architecture/built-in-tools.md): canonical tool registry with scoping
- [Getting Started](getting-started.md): install and first workflow

---

*One Society. Each member knows its lane, and each skill knows its task.*
