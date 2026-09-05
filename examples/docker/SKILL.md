---
name: docker
description: Use when building, running, or debugging Docker containers — Dockerfile creation, compose configurations, image optimization, volume management, and container networking. Use ONLY when the task involves Docker specifically, not general deployment.
license: MIT
---

# Docker

## Overview

Docker is the Society's containerization specialist. It handles Dockerfile authoring, Docker Compose orchestration, image optimization, and container debugging. Docker follows the principle of smallest possible image, fewest possible layers, and never running as root.

## When to Use

- When creating or optimizing Dockerfiles
- When writing or debugging docker-compose.yml configurations
- When investigating container startup failures or crashes
- When managing Docker volumes and networks
- When multi-stage builds are needed to reduce image size
- When debugging container networking or port mapping

## Process

### Writing a Dockerfile

1. Start from the smallest base that works (alpine > debian-slim > debian)
2. Use multi-stage builds for compiled languages
3. Combine RUN commands to reduce layers
4. Order layers by change frequency (rarely changing first)
5. Use `.dockerignore` to exclude node_modules, .git, tests
6. Run as non-root user
7. Pin base image versions for reproducibility

### Debugging Containers

1. Check logs: `docker logs <container>`
2. Execute into container: `docker exec -it <container> sh`
3. Inspect: `docker inspect <container>`
4. Check resource usage: `docker stats <container>`
5. Check events: `docker events --filter container=<container>`
6. If all else fails: `docker system df` to check disk usage

### Docker Compose

1. Define services with clear names
2. Use `depends_on` with health checks
3. Mount volumes for development, use named volumes for production
4. Set restart policies: `unless-stopped` for services
5. Use `.env` files for secrets, never hardcode

### Image Optimization

1. Use `--no-cache-dir` for package managers
2. Clean up in the same RUN layer: `apt-get clean && rm -rf /var/lib/apt/lists/*`
3. Use `.dockerignore` aggressively
4. Scan with `docker scout quickview <image>`
5. Check image size: `docker images <name>`

## Red Flags

- Running containers as root without justification
- Using `latest` tag for base images in production
- Copying node_modules into the image
- Multi-stage builds that don't actually reduce size
- Missing health checks in compose for dependent services

## Rationalizations

| What you think | What Docker knows |
|----------------|------------------|
| "Alpine is too limiting" | Alpine images are 5MB vs 200MB+. The limitation forces better practices. |
| "Multi-stage builds are too complex" | A 200MB image with build tools in production is more complex to debug. |
| "Just use COPY . ." | You're copying .git, node_modules, and tests into your image. Use .dockerignore. |
| "Health checks slow down startup" | Without them, compose starts dependent services before the dependency is ready. |

## Verification

Before confirming the change is done:

- [ ] Dockerfile builds without errors: `docker build -t test .`
- [ ] Image size is reasonable for the language/framework
- [ ] Container starts and passes health check
- [ ] No secrets or credentials in the image layers
- [ ] `.dockerignore` excludes development artifacts
- [ ] docker-compose.yml validates: `docker compose config`
