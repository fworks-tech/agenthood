"""Resolves member names to absolute paths of their Markdown skill files."""

from __future__ import annotations

import os
from pathlib import Path


class SkillsPathResolver:
    """Locates members/<name>/<name>.md relative to the Agenthood repo root.

    Resolution order:
    1. AGENTHOOD_ROOT env var (required in installed-package scenarios)
    2. Walk up from this file's location until we find a members/ directory
       (works when the runtime is checked out inside the agenthood repo)
    """

    def __init__(self) -> None:
        self._root = self._resolve_root()

    def _resolve_root(self) -> Path:
        env_root = os.environ.get("AGENTHOOD_ROOT")
        if env_root:
            root = Path(env_root).expanduser().resolve()
            if not (root / "members").is_dir():
                raise RuntimeError(
                    f"AGENTHOOD_ROOT={env_root} does not contain a members/ directory"
                )
            return root

        # Walk upward from this file looking for members/
        candidate = Path(__file__).resolve()
        for _ in range(10):
            candidate = candidate.parent
            if (candidate / "members").is_dir():
                return candidate

        raise RuntimeError(
            "Could not locate the agenthood repo root. "
            "Set AGENTHOOD_ROOT to the absolute path of the agenthood repository."
        )

    @property
    def root(self) -> Path:
        return self._root

    def resolve(self, member_name: str) -> Path:
        """Return the absolute path to <member_name>/<member_name>.md."""
        path = self._root / "members" / member_name / f"{member_name}.md"
        if not path.is_file():
            raise FileNotFoundError(
                f"Skill file not found for member '{member_name}': {path}"
            )
        return path

    def resolve_all(self, member_names: list[str]) -> list[str]:
        """Return a list of absolute path strings, one per member name."""
        return [str(self.resolve(name)) for name in member_names]
