"""Tests for MemberRegistry."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from agenthood_runtime.members.registry import MemberRegistry


@pytest.fixture(autouse=True)
def set_agenthood_root() -> None:
    candidate = Path(__file__).resolve()
    for _ in range(10):
        candidate = candidate.parent
        if (candidate / "members").is_dir():
            os.environ["AGENTHOOD_ROOT"] = str(candidate)
            yield
            del os.environ["AGENTHOOD_ROOT"]
            return
    pytest.skip("Could not locate agenthood repo root — set AGENTHOOD_ROOT")


def test_registry_builds_without_error() -> None:
    registry = MemberRegistry()
    assert len(registry.names()) == 14


def test_get_returns_spec_with_skills_path() -> None:
    registry = MemberRegistry()
    spec = registry.get("the-scribe")
    assert spec["name"] == "the-scribe"
    assert len(spec.get("skills", [])) == 1
    assert spec["skills"][0].endswith("SKILL.md")


def test_get_unknown_member_raises() -> None:
    registry = MemberRegistry()
    with pytest.raises(KeyError, match="the-ghost"):
        registry.get("the-ghost")


def test_all_members_have_skills_injected() -> None:
    registry = MemberRegistry()
    for name, spec in registry.all().items():
        assert spec.get("skills"), f"{name}: skills not injected"
