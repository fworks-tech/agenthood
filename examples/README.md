# Skill Examples

Domain-specific sample skills demonstrating the Agenthood skill format.

Each skill is a complete, working `SKILL.md` that follows the conventions in [CONTRIBUTING-skills.md](../CONTRIBUTING-skills.md).

## Available Examples

| Skill | Domain | Description |
|-------|--------|-------------|
| [git](git/SKILL.md) | Version Control | Interactive rebase, bisect, stash management, conflict resolution |
| [docker](docker/SKILL.md) | Containers | Dockerfile authoring, compose, image optimization, debugging |
| [postgres](postgres/SKILL.md) | Database | Schema design, query optimization, migrations, connection pooling |
| [redis](redis/SKILL.md) | Caching | Caching strategies, rate limiting, pub/sub, queue management |
| [api](api/SKILL.md) | REST API | Endpoint design, authentication, error handling, pagination |

## Using These Examples

1. Copy an example as a starting point: `cp -r examples/git skills/my-git/SKILL.md`
2. Edit the `name` and `description` frontmatter
3. Customize the Process section for your use case
4. Test with `agenthood run my-git "do something"`

## Creating Your Own

See [CONTRIBUTING-skills.md](../CONTRIBUTING-skills.md) for the full guide.
