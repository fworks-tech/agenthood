# Deep Agents Patterns in Agenthood

Five patterns from LangChain's [deepagents examples](https://github.com/langchain-ai/deepagents/tree/main/examples), translated onto Agenthood's primitives. The goal is not a port — it is a mapping, so a team that knows one system can read the other and a pattern can be copied without importing a framework.

| Issue | Pattern | Agenthood primitive |
|-------|---------|---------------------|
| [#341](https://github.com/fworks-tech/agenthood/issues/341) | Deployed content writer, per-user memory | Project memory + content skills + `mailman` for delivery |
| [#342](https://github.com/fworks-tech/agenthood/issues/342) | Sandboxed coding agent | Docker script sandbox (ADR-036) + a chain that gates on review |
| [#343](https://github.com/fworks-tech/agenthood/issues/343) | Deep research, 5 steps | `chains.yaml` with a parallel delegation step |
| [#344](https://github.com/fworks-tech/agenthood/issues/344) | Content builder: memory + skills + subagents | `AGENTS.md` + skills + `chains.yaml` (and `generate_image`) |
| [#345](https://github.com/fworks-tech/agenthood/issues/345) | Async subagent server | `agenthood mcp` + `delegate_task` + the event bus |

## 1. Deployed content writer (#341)

The original scopes memory per user behind Supabase auth and ships a skill per
content type.

**Agenthood equivalent.** A project is the memory scope: `.agenthood/memory/`
holds project conventions and decisions, and the Scholar/`mailman` path owns
delivery. Content types are ordinary skills — one `SKILL.md` per format, all
discovered from `skills/` and activated by name.

```
skills/blog-post/SKILL.md
skills/social-post/SKILL.md
```

A run that needs a format activates it; a workflow that needs three formats uses
a `parallel` step (see pattern 4). Per-user isolation is a deployment concern
(one project directory per tenant) rather than an in-process auth layer.

**Deliberately different:** Agenthood has no built-in auth provider. If a
deployment needs per-user scoping, give each tenant its own project path and let
the host enforce identity — the runtime never assumes a user is authenticated.

## 2. Sandboxed coding agent (#342)

The original runs a plan → implement → review → deliver loop inside a LangSmith
sandbox with full shell access.

**Agenthood equivalent.** Bundled skill scripts run in Docker by default
(ADR-036); a host run requires a trusted author, and the sandbox fails closed
when Docker is unavailable. The loop is declared, not coded:

```yaml
chains:
  - name: ship
    sequence:
      - member: architect
      - member: tester
      - member: builder
      - member: reviewer
      - member: doorman
        when: { step: reviewer, notContains: "[blocking]" }
    guards: { stop_on_blocking: true }
    max_rounds: 2
```

Run it with `agenthood workflow run ship "implement issue #42"`. Every step goes
through `MemberRunner`, so decisions, provenance and traces match a direct
`agenthood run`.

## 3. Deep research (#343)

The original saves the request, plans with TODOs, delegates to sub-agents,
synthesises, and responds — with a `think_tool` between searches.

**Agenthood equivalent.** The five steps are a chain; the delegation step is
`parallel`, and each branch is a member whose job is research:

```yaml
chains:
  - name: research
    sequence:
      - member: strategist
      - parallel:
          - member: librarian
          - member: auditor
      - member: herald
    guards: { stop_on_blocking: true }
    max_rounds: 1
```

`delegate_task` gives a subagent an isolated context (`isolation: "full"`) and an
optional skill (`skill: "web-research"`), so research noise does not enter the
calling window. The `think_tool` equivalent is the member's own Process section:
reflection is instructions, not a tool round-trip.

The research skill itself ships as [`skills/web-research/SKILL.md`](../../skills/web-research/SKILL.md):
plan the subtopics, delegate each to a parallel agent with its own search budget, save findings as files
with citations, then synthesise one cited report. A runnable chain lives in
[`examples/research/chains.yaml`](../../examples/research/chains.yaml).

## 4. Content builder (#344)

The original combines three filesystem primitives: `AGENTS.md` for brand voice,
`skills/*/SKILL.md` for workflows, and `subagents.yaml` for delegated tasks.

**Agenthood equivalent.** The same three primitives exist with the same split:

| Original | Agenthood |
|----------|-----------|
| `AGENTS.md` (brand voice) | `AGENTS.md` is read per repo and injected as untrusted project context |
| `skills/*/SKILL.md` | `skills/<name>/SKILL.md`, discovered and activated on demand |
| `subagents.yaml` | `chains.yaml`, including `parallel` branches and `skill:` steps |
| Gemini cover image | `generate_image` (multimodal provider, #124) |

```yaml
chains:
  - name: content
    sequence:
      - member: strategist
      - skill: brand-voice
        agent: builder
      - parallel:
          - skill: blog-post
          - skill: social-post
      - skill: cover-image
        agent: builder
```

The skill names above are illustrative — create them under `skills/` in your
project. An unknown name is stripped from the task with a warning rather than
run as a bare member.

**Deliberately different:** a skill step runs `/<skill> <task>` through a real
member, so budget, gating and fallback apply. It is not a separate execution
engine.

## 5. Async subagent server (#345)

The original is an Agent Protocol server (create thread, run, poll, cancel) plus
a supervisor REPL.

**Agenthood equivalent.** `agenthood mcp` already exposes skills as MCP tools
over stdio for external hosts. In-process, `delegate_task` is the supervisor →
subagent call, and lifecycle events (`RunEventBus`) are the status feed a host
can poll or subscribe to; cancellation is the queue's job
(`ConcurrencyQueue`), not a bespoke endpoint.

What is deliberately absent: Agent Protocol's HTTP surface. A deployment that
needs `POST /threads` should put that protocol in front of `agenthood mcp` or the
runtime API rather than growing a second one inside the core.

## What not to copy

- **A second instruction file.** Brand voice belongs in `AGENTS.md`, workflows in
  skills. Two files that both describe behaviour drift apart.
- **A separate subagent config format.** `chains.yaml` is the only composition
  file; a second YAML dialect would need a second validator.
- **Shell access as the default.** Scripts run in Docker unless the author is
  trusted; a pattern that assumes host execution must opt in explicitly.
