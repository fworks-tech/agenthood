# Definition of Done

A standing bar that every change must clear. Complements per-task acceptance criteria.

## Correctness
- [ ] All acceptance criteria met
- [ ] Behavior verified at runtime, not just compiled
- [ ] New behavior covered by tests that fail without the change
- [ ] Existing tests still pass; no regressions
- [ ] Edge cases and error paths handled

## Quality
- [ ] Code reveals intent through naming and structure
- [ ] No duplicated business logic
- [ ] No dead code, debug output, or commented-out blocks
- [ ] Changes scoped to the task; no unrelated refactors
- [ ] Linting and formatting pass

## Integration
- [ ] Change works with the rest of the system, not just in isolation
- [ ] Database migrations, config changes, and feature flags accounted for
- [ ] Backward compatibility considered for any public interface change

## Documentation
- [ ] Public interfaces, APIs, and user-facing behavior documented
- [ ] Architectural decisions recorded as ADRs

## Ship-readiness
- [ ] Security implications reviewed for untrusted input, auth, data handling
- [ ] Observability in place for new critical paths
- [ ] Rollback path exists for anything risky
- [ ] Human has reviewed and approved before merge or deploy
