"""MemberRegistry: resolves member names to fully-configured SubAgent specs."""

from __future__ import annotations

from copy import deepcopy

from agenthood_runtime.members.loader import SkillsPathResolver
from agenthood_runtime.members.specs import ALL_MEMBERS, SubAgent


class MemberRegistry:
    """Combines SubAgent specs with resolved skill file paths.

    On construction, validates that every spec in ALL_MEMBERS has a
    corresponding .md file — catches drift between specs.py and members/.
    """

    def __init__(self, resolver: SkillsPathResolver | None = None) -> None:
        self._resolver = resolver or SkillsPathResolver()
        self._validate()

    def _validate(self) -> None:
        missing: list[str] = []
        for name in ALL_MEMBERS:
            try:
                self._resolver.resolve(name)
            except FileNotFoundError:
                missing.append(name)
        if missing:
            raise RuntimeError(
                f"The following members have specs in specs.py but no .md file: "
                f"{', '.join(missing)}. "
                f"Check AGENTHOOD_ROOT={self._resolver.root}"
            )

    def get(self, name: str) -> SubAgent:
        """Return a fully-configured SubAgent spec with skills path injected."""
        if name not in ALL_MEMBERS:
            available = ", ".join(sorted(ALL_MEMBERS))
            raise KeyError(
                f"Unknown member '{name}'. Available members: {available}"
            )
        spec = deepcopy(ALL_MEMBERS[name])
        spec["skills"] = self._resolver.resolve_all([name])
        return spec

    def names(self) -> list[str]:
        return sorted(ALL_MEMBERS)

    def all(self) -> dict[str, SubAgent]:
        return {name: self.get(name) for name in ALL_MEMBERS}
