# Testing Patterns

## Structure
- AAA pattern: Arrange, Act, Assert
- Test names describe behavior: `it('rejects empty titles')`
- One assertion per concept per test
- Tests read like specifications, not implementation notes

## Pyramid
- Unit tests (80%): pure logic, milliseconds each
- Integration tests (15%): API boundaries, test DB
- E2E tests (5%): critical user flows only

## Anti-Patterns
| Anti-pattern | Fix |
|---|---|
| Testing implementation details | Test inputs and outputs, not internal structure |
| Flaky tests | Use deterministic assertions, isolate state |
| Mocking everything | Prefer real implementations > fakes > stubs > mocks |
| No test isolation | Each test sets up and tears down its own state |
| Snapshot abuse | Use sparingly, review every change |
