---
name: the-example
description: Use as the starting point for a third-party member; copy the directory, rename it, then replace the Process section.
license: MIT
metadata:
  author: your-handle
  version: 0.1.0
source_url: https://github.com/you/the-example
---

# The Example

## Overview

A reference implementation of a minimal contrib member. It exists so a
third-party author can copy a file that already satisfies the structure,
frontmatter and security expectations instead of reconstructing them from the
conventions.

## When to Use

- You are authoring your first member outside the Agenthood repository
- You need a shape that `agenthood verify` accepts unchanged
- You are reviewing a contrib PR and want the expected baseline

## Process

### 1. Copy and rename

Copy this directory to `skills/contrib/the-<your-name>/` and rename the
directory. Update `name` to match, and replace `metadata.author` with your
registry handle.

### 2. State what the member does

Rewrite the Overview with the member's philosophy and the When to Use section
with its trigger scenarios. Keep the Process steps imperative and verifiable.

### 3. Declare what you need

Add `requires.tools` for tools the member calls and `metadata.version` for the
release. Leave `allowed-tools` out unless the member must be restricted further
than its permission profile.

## Red Flags

- The directory name and the `name` field disagree
- `metadata.author` is missing or is not your handle
- The member copies another member's body instead of activating it by name
- A bundled script is added without a security review

## Rationalizations

- "Namespacing can wait until publishing": the owner is the publish key and
  the update key; adding it later means re-reviewing every copy.
- "The example does not need the required sections": the Sentinel checks the
  example too, and a broken reference teaches the wrong shape.

## Verification

- `agenthood verify --contrib` reports the skill and no contrib problems
- `agenthood skills --show-disabled` lists it with no blocked reason
- `agenthood verify --update-lock` records the SKILL.md hash once the body is final
