# Agent Analysis — Data Handling and Opt-Out

The Agenthood PR workflow (`.github/workflows/pr.yml`) runs LLM-based code
analysis on every pull request via the `agent-analysis` composite action
(`.github/actions/agent-analysis`). This document states what data is sent,
where it goes, and how to opt out.

## What data is sent

For each PR, the `agent-analysis` step:

1. Lists changed file **names** in the PR diff (`git diff --name-only`,
   capped at `max-files`, default 15).
2. Embeds those names into a member-specific prompt template (e.g. "audit
   these changed files for security concerns...").
3. Invokes the local Agenthood CLI (`node dist/cli.js run <member> <prompt>
   --provider opencode-go`) on the CI runner.

The LLM agent then operates on the checkout **on the runner**: it reads file
contents from the working tree itself, exactly as a human reviewer would. The
prompt contains file paths only — no diff or file content is copied into the
prompt by the action.

## Where data is sent

- The agent runs through the opencode-go provider (`OPENCODE_API_KEY`), with
  the standard provider fallback chain if it is unavailable.
- The provider is an external LLM API; the prompt (file names + member
  instructions) and anything the agent reads from the checkout while
  answering are sent to it.
- The agent's analysis output is posted as a comment on the PR and is also
  visible in the workflow run log.

## How to opt out

- **Clear the key**: delete/unset `OPENCODE_API_KEY` in the repository or
  environment secrets. The step skips itself with a notice:
  `OPENCODE_API_KEY not set -- skipping <member> agent analysis.`
- **Remove the jobs**: delete the `agent-analysis` steps from
  `.github/workflows/pr.yml` (under `gitleaks`, `filesize`, and `sentinel`),
  or remove the three jobs entirely.
- **Restrict which files are analyzed**: the analysis only ever receives
  changed files from same-repo PRs; set `max-files` lower to shrink scope.

## Also note

- File names in prompts are sanitized against shell metacharacters before
  being passed to the CLI (`grep -v '[^-_./a-zA-Z0-9]'`).
- Analysis output posted to PRs is filtered for credential-like lines
  (`api key`, `token`, `secret`, `password`, `credential`, `bearer`, `pat`,
  `jwt`) before the comment is published.
