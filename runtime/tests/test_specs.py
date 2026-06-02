"""Tests for SubAgent specs — validates 14 members are defined and well-formed."""

from __future__ import annotations

from agenthood_runtime.members.specs import ALL_MEMBERS

EXPECTED_MEMBERS = {
    "the-scribe", "the-architect", "the-reviewer", "the-tester",
    "the-debugger", "the-auditor", "the-herald", "the-librarian",
    "the-doorman", "the-steward", "the-oracle", "the-sentinel",
    "the-warden", "the-envoy",
}


def test_all_14_members_defined() -> None:
    assert set(ALL_MEMBERS.keys()) == EXPECTED_MEMBERS


def test_every_spec_has_required_keys() -> None:
    required = {"name", "description", "model", "tools", "permissions"}
    for name, spec in ALL_MEMBERS.items():
        missing = required - set(spec.keys())
        assert not missing, f"{name} is missing keys: {missing}"


def test_every_spec_name_matches_key() -> None:
    for key, spec in ALL_MEMBERS.items():
        assert spec["name"] == key, f"name mismatch: key={key}, spec.name={spec['name']}"


def test_tools_are_lists_of_strings() -> None:
    for name, spec in ALL_MEMBERS.items():
        tools = spec.get("tools", [])
        assert isinstance(tools, list), f"{name}: tools must be a list"
        assert all(isinstance(t, str) for t in tools), f"{name}: all tools must be str"


def test_permissions_are_valid() -> None:
    valid = {"restricted", "standard", "trusted"}
    for name, spec in ALL_MEMBERS.items():
        assert spec.get("permissions") in valid, (
            f"{name}: invalid permissions '{spec.get('permissions')}'"
        )
