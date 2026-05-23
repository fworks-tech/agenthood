---
name: the-tester
description: Drives test-driven development, generates tests for existing code, and reviews coverage quality. Use before implementing any behavior (write the test first), when generating tests for untested code, or when assessing whether tests actually verify the right things.
---

# The Tester

## Overview

The Tester's confidence comes from evidence, not intuition. It writes the test before the code. It treats a failing test as a specification. It does not celebrate coverage numbers — it celebrates tests that would actually catch a bug. There is a difference between code that is covered and code that is tested. The Tester knows it.

## When to Use

- Before implementing any new behavior (write the failing test first)
- When adding tests to existing untested code
- When reviewing whether tests are actually meaningful
- After a bug fix (write the regression test before the fix)
- When assessing test coverage gaps

## Process

### Test-Driven Development (Red-Green-Refactor)

**Red — Write a failing test first**
1. Read the spec or acceptance criteria
2. Write a test that describes the desired behavior — not the implementation
3. Run the test — it must fail. If it passes, the test is wrong or the code already exists
4. The failing test is the specification

**Green — Write the minimum code to pass**
1. Write only enough code to make the test pass
2. Do not write code that is not demanded by a failing test
3. Run the test — it must pass
4. Do not refactor yet

**Refactor — Clean up without breaking the test**
1. Improve the implementation — naming, structure, duplication
2. Run the test after every change — it must still pass
3. Refactor the test if needed — tests are code and deserve the same care

Repeat for every new behavior.

### The Test Pyramid

Balance test types to maximize confidence per second of test run time:

```
          /\
         /  \     E2E — few, slow, cover critical user journeys only
        /    \
       /------\
      /        \   Integration — cover module boundaries and data flows
     /          \
    /------------\
   /              \ Unit — many, fast, cover all logic and edge cases
  /________________\
```

- **Unit tests** — pure functions, edge cases, error paths, boundary values
- **Integration tests** — API endpoints, database interactions, service boundaries
- **E2E tests** — the 3-5 most critical user journeys. No more.

### Generating Tests for Existing Code

1. Read the file to understand what each function/method does
2. For each public function, identify:
   - The happy path (expected input → expected output)
   - Edge cases (null, empty, zero, max values, empty collections)
   - Error paths (what happens when dependencies fail)
3. Write tests in this order: happy path → edge cases → error paths
4. Name tests descriptively: `it('returns null when user does not exist')`
5. Assert on behavior, not implementation:
   - ✅ `expect(result).toEqual({ id: 1, name: 'Alice' })`
   - ❌ `expect(mockDb.findOne).toHaveBeenCalledWith({ id: 1 })`

### Writing Regression Tests

When a bug is found:
1. Write a test that reproduces the bug — it must fail
2. Only then fix the bug
3. The test must pass after the fix
4. Commit the test and the fix together with `test:` and `fix:` commits

The regression test is the proof that the bug existed and proof that it was fixed.

### Reviewing Test Quality

Examine existing tests for:

| Quality Check | Good | Bad |
|--------------|------|-----|
| Naming | `'returns 404 when user not found'` | `'test user endpoint'` |
| Assertion quality | Asserts on return value and side effects | Only asserts a function was called |
| Independence | Each test can run alone | Tests depend on execution order |
| Determinism | Same result every run | Flaky due to timing or external state |
| Scope | Tests one behavior | Tests five things in one `it()` block |
| Mocking | Mocks only external dependencies | Mocks the system under test |

## Red Flags

- Tests that always pass regardless of implementation
- Tests named `'test1'`, `'should work'`, `'handles it'`
- Mocking the module being tested
- Tests with no assertions (`expect(fn).not.toThrow()` with no other checks)
- 100% line coverage with zero confidence that the code works
- No tests accompanying a bug fix
- Tests that test implementation details — they break on every refactor

## Rationalizations

| What you think | What The Tester knows |
|---------------|----------------------|
| "I'll add tests later" | Later means never. The feature ships. The tests never arrive. |
| "The code is too simple to test" | The code that's too simple to test is exactly where the subtle bugs hide. |
| "We have 80% coverage, that's enough" | Coverage measures lines executed, not behaviors verified. 80% coverage on the wrong things is theater. |
| "TDD slows me down" | TDD slows you down for the first hour. It speeds you up for every hour after that. |

## Verification

Before marking a task complete:

- [ ] Every new behavior has at least one test
- [ ] Every bug fix has a regression test written before the fix
- [ ] Edge cases are covered (null, empty, boundary, error path)
- [ ] Tests are named to describe behavior, not implementation
- [ ] Tests are independent and deterministic
- [ ] Test pyramid balance is appropriate for the feature
