# Spec: Sandbox Phase 2 — Docker Container Isolation

## Problem
Phase 1 (#665) ships a local `--sandbox` profile: strict skill-integrity gate plus human confirmation before every tool call. Phase 2 adds a defense-in-depth container layer: run member tools inside a Docker container with a read-only filesystem, a temp-dir workspace, and context passed by mount.

## Proposed Solution
Extend `applySandboxProfile` to detect Docker availability and, when present, configure the runtime to execute member tool calls inside a container. When Docker is unavailable, fall back to the phase-1 local profile (strict integrity + interactive confirmation).

### Docker detection
- `docker info` (or `docker version`) via `execFileSync` with a timeout.
- Cache the result per process (availability does not change at runtime).

### Container profile
- Read-only root filesystem (`readOnly: true`).
- Workspace mounted from a temp dir (`workdir`).
- Context (skill content, config) passed by mount.
- Network disabled by default (`networkMode: 'none'`).
- Resource limits: `memory: 256m`, `cpus: 1`.

### Fallback
- If Docker is unavailable, log a notice and apply the phase-1 profile.
- No silent downgrade without notice — the user must know they are not getting container isolation.

## Out of Scope
- Windows Docker Desktop specifics (the runner targets Linux/macOS containers).
- Container image registry management (use the default `node:24-alpine` or a configurable image).
- Multi-container orchestration (one container per tool call).

## Acceptance Criteria
- [ ] `applySandboxProfile` detects Docker and sets `config.security.dockerIsolation: true` when available.
- [ ] Falls back to phase-1 profile with a visible notice when Docker is unavailable.
- [ ] Container runs with read-only filesystem and temp-dir workspace.
- [ ] Network is disabled by default.
- [ ] Tests cover both Docker-available and Docker-unavailable paths.

## Testing Strategy
- Unit: mock `execFileSync` to simulate Docker available/unavailable.
- Unit: assert config shape changes correctly for each path.
- E2E (manual): verify container isolation with a real Docker daemon.
