# Designing Scripts for Skills

> A bundled script is a tool the model calls without reading it. Its interface is whatever it prints,
> and its failure mode is whatever it exits with. Design for that reader.

A skill can bundle executables under `scripts/`, and `agenthood verify --scripts` lints them against
the rules below. The lint is advisory; the failures it catches are not.

---

## The contract

| Property | Rule | Why |
|----------|------|-----|
| Arguments | Everything is a flag or a positional argument | stdin is closed during a run — a script that waits for input hangs |
| `--help` | Always, printing usage and options | This is how the model discovers the interface |
| Output | JSON on stdout when the skill declares `output_format: json` | The model parses structure; prose forces another turn |
| Exit codes | `0` success, `1` error, `2` usage | Anything else is outside the agreed contract |
| Errors | One line on stderr, naming the value, the expectation, and the next step | "Invalid input" costs a turn; the fix costs none |
| Destructive work | Gated behind `--dry-run` | The model runs a script before it knows what it does |
| Idempotency | Re-running is safe, or the script says why not | Retries happen without a human deciding |

These are the five rules `verify --scripts` enforces, in the same order.

## A good script, and a bad one

**Bad** — hangs, guesses, and exits silently:

```python
import sys
name = input("Service name: ")          # stdin is closed: this run dies here
import subprocess
subprocess.run(f"kubectl delete deploy {name}", shell=True)   # no --dry-run, no message
sys.exit(3)                              # outside the contract
```

**Good** — discoverable, structured, reversible:

```python
#!/usr/bin/env python3
import argparse, json, subprocess, sys

def main() -> int:
    parser = argparse.ArgumentParser(description="Delete a deployment, or show what would be deleted.")
    parser.add_argument("service", help="Deployment name, e.g. auth-api")
    parser.add_argument("--namespace", default="default")
    parser.add_argument("--dry-run", action="store_true", help="Print the command without running it")
    args = parser.parse_args()

    cmd = ["kubectl", "delete", "deployment", args.service, "-n", args.namespace]
    if args.dry_run:
        print(json.dumps({"dry_run": True, "command": cmd}))
        return 0
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"error: kubectl failed for {args.service}. {result.stderr.strip()}. Try --dry-run first.", file=sys.stderr)
        return 1
    print(json.dumps({"deleted": args.service, "namespace": args.namespace}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

`argparse` supplies `--help`, the exit code is `0`/`1`, the destructive path is reversible, and the
output is one JSON object either way.

## Error messages that save a turn

The message reaches a model deciding what to do next. Include three things and nothing else:

```
error: <value> is not valid for <option>. Expected <shape>. Try --help.
error: <tool> not found. Install it with <command>, then re-run.
error: <path> not found. Check the path or run with --dry-run to inspect.
```

Compare "Invalid input" — the model retries the same call, then gives up and writes prose. A message
that names the valid shape converts a dead end into a second call.

## Idempotency and `--dry-run`

A run can be retried: a failover, a resumed checkpoint, a model that calls the same tool twice. An
idempotent script makes that free; a non-idempotent one makes it a duplicate resource, a double send,
or a second deletion attempt.

- Prefer create-or-update over create
- Check before acting, and report `already exists` as success, not error
- Any destructive or expensive branch gets `--dry-run` that prints the exact operation

`--dry-run` output is structured too: the model reads it and decides, so `{"dry_run": true, "command":
[...]}` is more useful than a sentence.

## Languages

Everything is supported through the runtime table (extension first, then shebang), and every language
gets the same interface rules:

| Language | Argument parsing | JSON | Notes |
|----------|------------------|------|-------|
| Bash | `getopts` or a `case` loop, plus a `usage()` | `printf '{"k":"%s"}\n'` or `jq` | Quote everything; `set -euo pipefail` |
| Python | `argparse` | `json.dumps` | No `input()`; shebang `#!/usr/bin/env python3` |
| Node / TS | `process.argv` or a parser | `JSON.stringify` | Run through `tsx`/`node` from the shebang |
| Go | `flag` | `encoding/json` | Compile once if it is called repeatedly |

A one-off command (`npx something@1.2.3`) is allowed only when version-pinned. Anything unpinned in a
script is refused — a tool that changes under a skill is a skill that breaks silently.

## Sandbox expectations

Scripts run in Docker by default; a host run requires the skill's author to be trusted (ADR-036). That
changes what a script may assume:

- **Assume an empty environment:** only what the image provides, plus explicit arguments
- **Assume no network** unless the image and the policy allow it
- **Assume no project files** outside the paths the skill passes in
- **Assume a timeout** (default 120 s, `skills.scriptTimeoutMs`); long work belongs in a background job

Output is capped at 30 KB inline, with the rest spilled to a file and the path reported. Print what
matters; write the rest to a file and return its path.

## Verification

- `agenthood verify --scripts` reports no findings for the skill
- `script --help` prints usage and every option
- A bad argument exits `2` with a one-line message naming the expected shape
- Re-running produces the same state, not a duplicate
- A destructive branch without `--dry-run` would be a review rejection

## References

- [ADR-036](../adr/ADR-036-skill-script-execution-and-sandboxing.md) — sandbox, runtimes, output caps
- [ADR-040](../adr/ADR-040-skill-body-structure.md) — how the body points at a script
- [The Builder](../../skills/builder/SKILL.md) — implementation standards a script follows
