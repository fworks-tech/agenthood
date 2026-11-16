# ADR-036: Skill Script Execution and Sandboxing

**Date:** 2026-11-15
**Status:** Accepted

## Context

Batch D asks for twelve things that only make sense together: run a skill's bundled
scripts (#546), resolve their dependencies (#539), pin one-off tools (#541, #545),
keep their interface agent-safe (#540, #547, #548), resolve the paths they reference
(#542), show what they bundle (#543), survive large output (#544), and do it without
letting untrusted code loose (#607, #536).

Today there is no execution path at all. `activate_skill` injects instructions; the
model then calls generic tools. A script referenced by a SKILL.md is executed, if at
all, by a shell command the model composes: no timeout, no sandbox, no output cap,
and no record of which skill it came from.

The hard constraint is trust. A skill is downloaded text from a stranger (ADR-029).
Its scripts are arbitrary code. Any design that treats "the skill said to run it" as
authorization is a remote-code-execution feature with extra steps.

## Decision

### 1. One tool, declared scripts only

A single tool `run_skill_script` executes scripts bundled under an **active** skill's
directory. Input: `{ skill, script, args?, dry_run? }`.

- `script` is a relative path under the skill directory (`scripts/extract.py`), or a
  one-off command reference (§4). Absolute paths, `..` and symlinks escaping the
  directory are refused before anything spawns.
- The skill must be active in this run. Activation is the authorization event; the
  model cannot name a skill it has not loaded.
- Execution cwd is the skill directory, so `./references/x.md` in the script resolves
  the same way it does in the SKILL.md prose.
- `--dry-run` is passed through unchanged; the tool never invents the flag.

### 2. Language detection, no per-language tools

The harness picks the runtime from the file extension, then the shebang:

| Detected | Command |
|---|---|
| `.py` / `python` shebang | `uv run` when a PEP 723 block is present, else `python3` |
| `.ts`, `.js` / `node` shebang | `deno run` when the file contains `npm:` imports, else `node` |
| `.sh`, `.bash` / `sh` shebang | `bash` |
| anything else | refused with the supported list |

The runtime version is printed in the tool result header, so a failing script is
debuggable without a second call. A missing runtime is an error naming what to
install: never a silent fallback to another language.

### 3. Inline dependencies

- **Python**: a PEP 723 `# /// script` block is honored by `uv run`. No block, no
  install.
- **TypeScript/JavaScript**: `npm:` imports are honored by `deno run`; a `package.json`
  next to the script is honored by `bun` when `deno` is absent.
- **Bash**: none. A bash script that needs packages is told to document them in
  `compatibility`, which already exists (#581).

Dependency installation output goes to the same capped stream as the script (§8), so
a failed install is visible and attributable.

### 4. One-off commands are pinned

`uvx`, `npx`, `pipx` and `cargo` reference a tool rather than a bundled file. The tool
accepts such a reference **only with an explicit version**: `uvx ruff@0.8.0 check .`
is allowed; `uvx ruff check .` is refused with "pin the version".

Reason: an unpinned one-off command is a moving dependency and makes the skill's
result unreproducible and unauditable. The parser accepts only the four prefixes and
splits the reference on whitespace; no shell string is ever evaluated.

### 5. Interface conventions are linted, not trusted

`agenthood verify --scripts` lints bundled scripts and reports:

- readable stdin in a script that is not a REPL (prompts hang an agent),
- missing `--help` handling when the script declares arguments,
- non-JSON output when the skill declares `output_format: json`,
- exit status outside `0/1/2`,
- a destructive branch with no `--dry-run`,
- an error path with no message (bare `exit 1`).

These are warnings in `verify`, not runtime refusals: static analysis cannot prove a
shell script never prompts. The runtime enforces what it can: a closed stdin, a
timeout, and a non-zero exit surfaced as an error.

### 6. Relative references are checked at activation

On activation, the skill body is scanned for path-like references (markdown links,
inline code spans that look like paths). Each is resolved under the skill directory,
and a missing target is reported in the activation block as a warning, not a failure,
because a skill may deliberately reference a path created at run time.

No reference is ever resolved outside the skill directory. That is the same boundary
as §1.

### 7. Resource listing is metadata only

Activation already lists `resources`. It now lists `path (kind, bytes)` and reads no
contents. `--eager` on activation pre-reads nothing either: it exists only to raise
the listing limit, because reading is what Tier 3 forbids (ADR on progressive
disclosure). Access is recorded locally per skill (existing `skill-stats.json`, plus
which resource), never sent anywhere.

### 8. Output is capped, and overflow becomes a file

Inline output is capped at **30 KB**. Above that:

- the full stream is written to
  `.agenthood/skill-output/<executionId>/<script>.log` (0600, gitignored),
- the tool returns the path plus the first and last 50 lines,
- `run_skill_script` accepts `{ page, page_size }` to read slices of that file.

The model therefore never silently loses the middle of a large result, and a second
call is cheap. Truncation and the path are always stated in the result.

### 9. Caching belongs to the runtime

Package caches use each runtime's own store (`uv`, `deno`, `bun`, `npm`), rooted in a
project-scoped cache directory. `--no-cache` maps to that runtime's flag. The harness
does not implement a package cache; it reports download output as-is and never claims
a hit rate it cannot observe.

### 10. Sandbox: Docker or nothing

`security.sandbox` (or `--sandbox`) runs the script in Docker:

```
--network none
--read-only
--tmpfs /tmp:rw,noexec,nosuid,size=64m
--cap-drop ALL
--security-opt no-new-privileges
--memory 512m --cpus 1 --pids-limit 128
-v <skill dir>:/skill:ro -w /skill
```

The project is **not** mounted. A script that needs project files is given them
through an explicit argument, and the tool copies only that path into a temp mount.
Network is denied, so a script that "phones home" fails, which is the point.

On a host without Docker, `--sandbox` **fails closed**: the script does not run, and
the error says why. A sandbox flag that silently degrades to no sandbox is worse than
no flag. Without the flag, a script runs locally only when the skill's tier is
`official` or its `metadata.author` is in `security.trustedAuthors`; every other
skill requires `--sandbox`.

Every execution appends one row to `.agenthood/skill-exec-audit.ndjson`: timestamp,
skill, script, argv, cwd, sandbox mode (`docker` or `host`), exit code, duration,
truncated, and the user who ran it. Audit logging is not optional under `--sandbox`.

### 11. Auto-allowlisting is scoped to the run and logged

Activating a skill records its directory in the run's allowlist. Path-based tools
accept paths under an active skill directory without a confirmation prompt, for the
lifetime of the run, and each accepted path is logged. `security.autoAllowSkillDirs:
false` disables it. It never widens the network or shell surface: only read access
to files the skill already ships.

## Consequences

- `src/skills/execution/` is the only place that spawns a skill script. Existing
  tools are untouched except for the allowlist check.
- `activate_skill` gains resource metadata and missing-reference warnings; its output
  stays one block.
- `verify --scripts` adds warnings, so existing skills keep passing.
- Community and experimental skills need Docker to run scripts; that is a real
  requirement, stated in the error rather than worked around.
- Windows: Docker Desktop is required for `--sandbox`; the host path uses the same
  spawn API and the same timeout. No POSIX-only flag is passed on Windows.
- MIGRATION: `security.sandbox` keeps its existing meaning (container isolation for
  member tools) and additionally requires Docker for every skill script; the
  confirmation behavior remains under `interactive`.

## Alternatives considered

| Option | Rejected because |
|---|---|
| One tool per language | Three tools with overlapping schemas; the model picks wrong |
| Let the model compose shell commands | No timeout, no sandbox, no provenance, no output cap |
| Allow unpinned one-off commands | Unreproducible and unauditable; a network surprise on every run |
| Enforce script conventions at runtime | Static analysis cannot prove absence of prompts; lint + closed stdin is honest |
| Read resources eagerly on activation | Defeats Tier 3 and wastes context on files the task never needs |
| Implement our own package cache | Duplicates uv/deno/bun caches and their lockfiles; drift for no gain |
| Sandbox without Docker (chroot, ulimit) | Not portable to Windows and not a security boundary on macOS |
| Degrade to host execution when Docker is missing | A sandbox flag that silently does nothing is a lie about isolation |
