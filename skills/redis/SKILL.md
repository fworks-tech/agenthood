---
name: redis
description: Manage Redis via the redis-cli. Use when interacting with Redis caches, queues, or key-value stores.
metadata:
  category: databases
  dependencies:
    cli: redis-cli
    checkCommand: redis-cli --version
    install:
      darwin: { brew: redis }
      linux: { apt: redis-tools }
      windows: { scoop: redis }
---

# redis-cli

Use `redis-cli` to interact with Redis instances.

## Common Commands

### Connection
- Connect: `redis-cli -h <host> -p <port>`
- Authenticate: `AUTH <password>`
- Ping: `PING`

### Key Operations
- Get value: `GET <key>`
- Set value: `SET <key> <value>`
- Delete key: `DEL <key>`
- Check existence: `EXISTS <key>`
- Set with expiry: `SETEX <key> <seconds> <value>`

### Inspection
- List all keys: `KEYS <pattern>`
- Key type: `TYPE <key>`
- TTL: `TTL <key>`
- Memory usage: `MEMORY USAGE <key>`
- Info: `INFO`

## Notes
- `KEYS *` is blocking on production — use `SCAN` for large datasets
- Default port is 6379
