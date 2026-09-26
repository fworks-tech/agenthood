# Guide: Troubleshooting Skills

> A skill that misfires is a skill with a bad contract, a bad trigger, or a bad
> environment. This guide tells the three apart in five minutes.

## Overview

Almost every skill failure falls into five buckets. Diagnose in order — each
step rules out one bucket before you touch anything.

## Symptoms and fixes

### 1. Skill never triggers

Cause: `description` doesn't say when to use it, so the provider never picks it.

```bash
npx agenthood verify   # confirms the skill parses and the name matches its directory
npx agenthood list     # confirms the skill is discovered and active
```

Fix: rewrite `description` as what **plus** when (`… . Use when …`). Vague
descriptions (`helps with code`) lose to every other skill in the registry.

### 2. Wrong output

Cause: body reads like a reference, not instructions for a careful new hire.

Fix: replace background prose with numbered steps, state what to ask before
guessing (owners, dates, scope), and declare the minimum `allowed-tools`.
Re-run with a narrower prompt to confirm the body — not the model — was at fault.

### 3. Context overflow

Cause: too many skills load full bodies into a finite window.

```bash
npx agenthood status   # check context-budget percentage per skill
```

Fix: shorten bodies, split multi-topic skills, and keep only the active
members enabled (`npx agenthood deactivate <member>` for the rest).

### 4. Script failures

Cause: skill scripts assume prompts, dependencies, or outputs the runtime
doesn't provide.

```bash
npx agenthood doctor   # environment, providers, skill files, lockfile integrity
```

Fix: scripts must run non-interactively with structured output and `--help`;
pin versions for one-off execution (`uvx`/`npx`/`pipx`). Surface stderr — a
silent script is undebuggable.

### 5. Provider errors

Cause: missing keys, wrong model, or failover misconfiguration.

```bash
npx agenthood health   # provider probes with a real request
npx agenthood log --level warn --limit 20   # recent warnings, redacted
npx agenthood trace    # recent invocation traces
```

Fix: set the key for your provider (`GROQ_API_KEY`, `OPENCODE_API_KEY`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) in `.env`, confirm the model in
`.agenthood/config.json`, and check `trace` for the failing step.

## Still stuck

1. `npx agenthood verify` — contract gate (name, description, tools, lockfile drift)
2. `npx agenthood doctor` — environment and integrity
3. `npx agenthood log --level error --limit 50` — redacted error trail
4. Open an issue with the `verify` output, the failing command, and the trace id.

## Further reading

- [5-minute skill creation quickstart](../academy/quickstart.md)
- [Authoring a Skill](../academy/level-3-advanced-skills/06-author-a-skill.md)
- [`src/core/RedactionFilter.ts`](../../src/core/RedactionFilter.ts) — what logs redact
