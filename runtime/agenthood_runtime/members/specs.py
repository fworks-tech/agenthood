"""14 SubAgent TypedDicts for all Agenthood Society members.

Tool scopes are derived from architecture/built-in-tools.md.
Permission profiles are derived from architecture/operating-modes.md.
"""

from __future__ import annotations

from typing import TypedDict

# ---------------------------------------------------------------------------
# SubAgent TypedDict — matches fworks-tech/deepagents SubAgent schema.
# ---------------------------------------------------------------------------


class SubAgent(TypedDict, total=False):
    name: str
    description: str
    system_prompt: str
    model: str
    tools: list[str]
    middleware: list[str]
    interrupt_on: list[str]
    skills: list[str]          # populated at runtime by MemberRegistry
    permissions: str           # "restricted" | "standard" | "trusted"
    response_format: str | None


# ---------------------------------------------------------------------------
# Default middleware stack (injected by MemberRegistry before invocation)
# ---------------------------------------------------------------------------

_DEFAULT_MIDDLEWARE = [
    "SkillsMiddleware",
    "MemoryMiddleware",
    "StewardMiddleware",
    "SummarizationMiddleware",
]

_SONNET = "claude-sonnet-4-6"
_HAIKU = "claude-haiku-4-5-20251001"

# ---------------------------------------------------------------------------
# Member definitions
# ---------------------------------------------------------------------------

THE_SCRIBE: SubAgent = {
    "name": "the-scribe",
    "description": (
        "Writes conventional commit messages, PR descriptions, and changelogs. "
        "The single source of truth for all human-readable project communication."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.write", "file.list", "file.search",
        "git.diff", "git.log", "git.status", "git.commit",
        "code.grep",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "interrupt_on": ["git.commit"],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_ARCHITECT: SubAgent = {
    "name": "the-architect",
    "description": (
        "Drives spec-first development, task decomposition, and architecture decisions. "
        "Use before any non-trivial implementation begins."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.write", "file.edit", "file.delete", "file.list", "file.search",
        "git.status", "git.branch",
        "code.grep", "code.symbols", "code.analysis",
        "search.web", "search.vector", "search.hybrid",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "interrupt_on": ["file.delete"],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_REVIEWER: SubAgent = {
    "name": "the-reviewer",
    "description": (
        "Conducts 5-axis code review: correctness, security, performance, "
        "maintainability, test coverage."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep", "code.symbols", "code.analysis", "code.diagnostics",
        "search.vector", "search.hybrid",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_TESTER: SubAgent = {
    "name": "the-tester",
    "description": (
        "Writes tests before implementation (TDD), maintains coverage targets, "
        "and validates acceptance criteria."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.write", "file.edit", "file.list", "file.search",
        "git.status",
        "code.grep",
        "terminal.run",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "interrupt_on": ["terminal.run"],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_DEBUGGER: SubAgent = {
    "name": "the-debugger",
    "description": (
        "Five-step debugging protocol: reproduce → isolate → hypothesize → test → fix. "
        "No guessing."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep", "code.symbols", "code.diagnostics",
        "terminal.run", "terminal.deep",
        "debug.stacktrace", "debug.variables", "debug.evaluate", "debug.control",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "interrupt_on": ["terminal.deep"],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_AUDITOR: SubAgent = {
    "name": "the-auditor",
    "description": (
        "OWASP Top 10 security review, dependency audit, secrets scanning. "
        "Required before merging security-sensitive code."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep", "code.diagnostics",
        "search.web", "search.vector",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_HERALD: SubAgent = {
    "name": "the-herald",
    "description": (
        "Manages semver determination, changelog generation, and release publishing. "
        "Required before any release."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.write", "file.edit", "file.list", "file.search",
        "git.status", "git.log", "git.push", "git.tag",
        "code.grep",
        "search.web",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "interrupt_on": ["git.push", "git.tag"],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_LIBRARIAN: SubAgent = {
    "name": "the-librarian",
    "description": (
        "Keeps documentation synchronized with code changes. "
        "Triggered after any code change that affects public interfaces or behaviour."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.write", "file.edit", "file.list", "file.search",
        "git.status",
        "code.grep",
        "search.web", "search.vector", "search.hybrid",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "standard",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_DOORMAN: SubAgent = {
    "name": "the-doorman",
    "description": (
        "Validates commit messages against conventional commit rules. "
        "Gatekeeps every commit — rejects forbidden subjects and malformed types."
    ),
    "model": _HAIKU,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.diff", "git.log", "git.status", "git.branch",
        "code.grep", "code.diagnostics",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_STEWARD: SubAgent = {
    "name": "the-steward",
    "description": (
        "Monitors context window capacity, routes tasks to the minimal required member set, "
        "and triggers session triage before capacity forces the decision."
    ),
    "model": _HAIKU,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": ["MemoryMiddleware", "StewardMiddleware"],
}

THE_ORACLE: SubAgent = {
    "name": "the-oracle",
    "description": (
        "Cross-session institutional memory. Retrieves past decisions, patterns, "
        "and context that spans multiple sessions."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status", "git.log",
        "code.grep",
        "search.vector", "search.hybrid",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_SENTINEL: SubAgent = {
    "name": "the-sentinel",
    "description": (
        "Guards quality standards: validates that new members follow the correct schema, "
        "that ADRs are present for significant decisions, and that CI gates are intact."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep", "code.diagnostics",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_WARDEN: SubAgent = {
    "name": "the-warden",
    "description": (
        "Enforces project conventions: file naming, directory structure, import rules, "
        "and coding standards not covered by the linter."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep", "code.diagnostics",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

THE_ENVOY: SubAgent = {
    "name": "the-envoy",
    "description": (
        "Cross-runtime translator. Adapts Agenthood member skills for non-Anthropic "
        "providers and translates between tool-calling conventions."
    ),
    "model": _SONNET,
    "tools": [
        "file.read", "file.list", "file.search",
        "git.status",
        "code.grep",
        "search.web", "search.vector",
        "memory.read", "memory.write", "tasks.read", "tasks.write", "think",
    ],
    "permissions": "restricted",
    "middleware": _DEFAULT_MIDDLEWARE,
}

# ---------------------------------------------------------------------------
# Canonical registry — name → spec
# ---------------------------------------------------------------------------

ALL_MEMBERS: dict[str, SubAgent] = {
    "the-scribe": THE_SCRIBE,
    "the-architect": THE_ARCHITECT,
    "the-reviewer": THE_REVIEWER,
    "the-tester": THE_TESTER,
    "the-debugger": THE_DEBUGGER,
    "the-auditor": THE_AUDITOR,
    "the-herald": THE_HERALD,
    "the-librarian": THE_LIBRARIAN,
    "the-doorman": THE_DOORMAN,
    "the-steward": THE_STEWARD,
    "the-oracle": THE_ORACLE,
    "the-sentinel": THE_SENTINEL,
    "the-warden": THE_WARDEN,
    "the-envoy": THE_ENVOY,
}
