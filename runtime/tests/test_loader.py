"""Tests for SkillsPathResolver."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from agenthood_runtime.members.loader import SkillsPathResolver


@pytest.fixture()
def resolver(agenthood_root: Path) -> SkillsPathResolver:
    os.environ["AGENTHOOD_ROOT"] = str(agenthood_root)
    r = SkillsPathResolver()
    yield r
    del os.environ["AGENTHOOD_ROOT"]


@pytest.fixture()
def agenthood_root() -> Path:
    # Walk up from this test file until we find the agenthood repo root.
    candidate = Path(__file__).resolve()
    for _ in range(10):
        candidate = candidate.parent
        if (candidate / "members").is_dir():
            return candidate
    pytest.skip("Could not locate agenthood repo root — set AGENTHOOD_ROOT")


def test_resolve_known_member(resolver: SkillsPathResolver) -> None:
    path = resolver.resolve("the-scribe")
    assert path.is_file()
    assert path.name == "the-scribe.md"


def test_resolve_unknown_member_raises(resolver: SkillsPathResolver) -> None:
    with pytest.raises(FileNotFoundError, match="the-ghost"):
        resolver.resolve("the-ghost")


def test_resolve_all_returns_strings(resolver: SkillsPathResolver) -> None:
    paths = resolver.resolve_all(["the-scribe", "the-architect"])
    assert len(paths) == 2
    assert all(isinstance(p, str) for p in paths)
