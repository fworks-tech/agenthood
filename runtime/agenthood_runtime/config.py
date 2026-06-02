"""RuntimeConfig: reads and validates .agenthood/config.json."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class RuntimeConfig:
    """Parsed view of .agenthood/config.json written by the Node.js CLI.

    The Node.js CLI is the authoritative writer of config.json. This class
    only reads it. Any key not defined in the schema is silently preserved
    under `extra` for forward-compatibility.
    """

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or self._locate()
        raw = self._load(self._path)
        self._parse(raw)

    # ------------------------------------------------------------------
    # Public properties matching the .agenthood/config.json schema
    # ------------------------------------------------------------------

    @property
    def version(self) -> str:
        return self._version

    @property
    def active_members(self) -> list[str]:
        return self._members

    @property
    def runtime(self) -> str:
        return self._runtime

    @property
    def default_model(self) -> str:
        return self._default_model

    @property
    def default_permissions(self) -> str:
        return self._default_permissions

    @property
    def member_permission_overrides(self) -> dict[str, str]:
        return self._permission_overrides

    @property
    def tool_scoping(self) -> dict[str, list[str]]:
        return self._tool_scoping

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def permission_for(self, member_name: str) -> str:
        return self._permission_overrides.get(member_name, self._default_permissions)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    @staticmethod
    def _locate() -> Path:
        """Walk upward from cwd to find .agenthood/config.json."""
        candidate = Path.cwd().resolve()
        for _ in range(10):
            config = candidate / ".agenthood" / "config.json"
            if config.is_file():
                return config
            candidate = candidate.parent
        raise FileNotFoundError(
            "Could not find .agenthood/config.json. "
            "Run `npx agenthood init` first, or pass an explicit path."
        )

    @staticmethod
    def _load(path: Path) -> dict[str, Any]:
        with path.open() as f:
            return json.load(f)

    def _parse(self, raw: dict[str, Any]) -> None:
        self._version = str(raw.get("version", "1"))
        self._runtime = str(raw.get("runtime", "claude-code"))
        self._members = [
            m for m in raw.get("members", []) if not str(m).startswith("_")
        ]
        provider = raw.get("provider", {})
        self._default_model = provider.get("model", "claude-sonnet-4-6")
        permissions = raw.get("permissions", {})
        self._default_permissions = permissions.get("profile", "standard")
        self._permission_overrides = {
            k: v
            for k, v in permissions.get("overrides", {}).items()
            if not k.startswith("_")
        }
        self._tool_scoping = {
            k: v
            for k, v in raw.get("toolScoping", {}).items()
            if not k.startswith("_")
        }
