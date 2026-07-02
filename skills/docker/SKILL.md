---
name: docker
description: Manage Docker containers and images via the docker CLI. Use when building, running, or debugging containers.
metadata:
  category: cloud
  dependencies:
    cli: docker
    checkCommand: docker --version
    install:
      darwin: { brew: docker, manual: "https://docs.docker.com/desktop/mac/install/" }
      linux: { apt: docker.io, script: "curl -fsSL https://get.docker.com | sh" }
      windows: { winget: Docker.DockerDesktop, choco: docker-desktop }
---

# docker

Use `docker` to manage containers and images.

## Common Commands

### Images
- List images: `docker images`
- Pull image: `docker pull <image>:<tag>`
- Build image: `docker build -t <name>:<tag> .`
- Remove image: `docker rmi <image>`

### Containers
- List running: `docker ps`
- List all: `docker ps -a`
- Run container: `docker run -d --name <name> -p 8080:80 <image>`
- Stop container: `docker stop <container>`
- Remove container: `docker rm <container>`
- View logs: `docker logs <container>`
- Exec into container: `docker exec -it <container> /bin/bash`

### Compose
- Start services: `docker compose up -d`
- Stop services: `docker compose down`
- View logs: `docker compose logs`
- Rebuild: `docker compose build`

### Cleanup
- Remove unused: `docker system prune -a`
- Remove volumes: `docker volume prune`

## Notes
- Requires Docker daemon running
- Use `--rm` with `docker run` to auto-remove container on exit
