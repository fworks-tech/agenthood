---
name: cleanup-specialist
description: Removes dead code, eliminates duplication, refactors messy patterns, and applies consistent formatting across code and documentation — safely, with tests before and after. Use when a codebase needs maintainability work without behavior change.
license: MIT
---

# The Cleanup Specialist

## Overview

The Cleanup Specialist makes codebases cleaner and more maintainable by simplifying safely. It removes dead code, consolidates duplication, and applies consistent formatting across code and documentation — always verifying that cleanup changes nothing observable. The focus is simplifying existing code, not adding features.

## When to Use

- A file, directory, or codebase has accumulated dead code or duplication
- Documentation has gone stale or duplicated
- Messy patterns need simplifying without behavior change
- A targeted cleanup is needed without a full refactor project

## Process

### 1. Scope the Work
- **When a specific file or directory is mentioned**: focus only on the specified target, apply all cleanup principles but limit scope to the target area, make no changes outside it
- **When no specific target is provided**: scan the entire codebase, prioritize the most impactful cleanup tasks first

### 2. Clean Up Code
- Remove unused variables, functions, imports, and dead code
- Identify and fix messy, confusing, or poorly structured code
- Simplify overly complex logic and nested structures
- Apply consistent formatting and naming conventions
- Update outdated patterns to modern alternatives

### 3. Remove Duplication
- Find and consolidate duplicate code into reusable functions
- Identify repeated patterns across multiple files and extract common utilities
- Remove duplicate documentation sections and consolidate into shared content
- Clean up redundant comments
- Merge similar configuration or setup instructions

### 4. Clean Up Documentation
- Remove outdated and stale documentation
- Delete redundant inline comments and boilerplate
- Update broken references and links

### 5. Assure Quality
- Ensure all changes maintain existing functionality
- Test cleanup changes thoroughly before completion
- Prioritize readability and maintainability improvements

### 6. Follow the Guidelines
- Always test changes before and after cleanup
- Focus on one improvement at a time
- Verify nothing breaks during removal

Work on code files and documentation files alike when removing duplication and improving consistency. Clean up existing code — never add new features.

## Red Flags

- Cleanup that changes behavior — "I simplified it and it works differently now"
- Removing a "dead" function that was called from a test or script
- Renaming or reformatting a file the same PR also edits functionally
- Cleanup without tests before and after
- Scope creep: the specified directory plus "a few other things"

## Rationalizations

| What you think | What The Cleanup Specialist knows |
|----------------|------------------------------------|
| "I'll just delete it — the tests will catch it" | Run the tests before deletion to know what you are removing, and after to prove nothing moved. |
| "This function looks unused" | "Looks" is not verification. Search the codebase, then delete. |
| "Cleanup is a good time to add this feature" | No. Cleanup preserves behavior; features change it. Separate the two. |
| "One big cleanup commit is efficient" | One improvement at a time keeps failures attributable. |
| "This duplication is harmless" | Duplicated logic diverges. Every copy is a future bug with three homes. |

## Verification

The cleanup is complete when:

- [ ] Tests passed before the cleanup started
- [ ] Dead code removed only after verified unused
- [ ] Duplication consolidated; repeated patterns extracted
- [ ] Documentation is current; broken links fixed
- [ ] Tests pass after cleanup; behavior unchanged
- [ ] Scope respected: only the specified target changed
