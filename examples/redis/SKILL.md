---
name: redis
description: Use when interacting with Redis — caching strategies, pub/sub, rate limiting, session storage, queue management, and debugging key expiration. Use ONLY when the task involves Redis specifically, not general caching.
license: MIT
---

# Redis

## Overview

Redis is the Society's caching and real-time specialist. It handles caching strategies, pub/sub messaging, rate limiting, session storage, and queue management using Redis data structures. Redis follows the principle that cache invalidation is hard, so design for expiration from the start.

## When to Use

- When implementing caching layers (read-through, write-through, write-behind)
- When setting up rate limiting (sliding window, token bucket)
- When building real-time features with pub/sub
- When managing session storage
- When implementing job queues with Redis Lists or Streams
- When debugging key expiration or memory issues

## Process

### Caching Strategy

1. Define cache key namespace: `service:entity:id:field`
2. Set TTL based on data volatility (short for fast-changing, long for static)
3. Use `SET key value EX ttl` for simple caching
4. Use hash for object caching: `HSET key field value`
5. Implement cache-aside: check cache first, fall back to DB, populate cache
6. Handle cache stampede: use `SET NX EX` for lock-based refresh

### Rate Limiting

1. Sliding window: use `ZRANGEBYSCORE` with timestamps
2. Token bucket: use `INCR` with `EXPIRE`
3. Fixed window: use `INCR` with `EXPIRE` (simplest, least accurate)
4. Store rate limit key with TTL matching window size
5. Return `429 Too Many Requests` when limit exceeded

### Pub/Sub

1. Use `SUBSCRIBE channel` for consumers
2. Use `PUBLISH channel message` for producers
3. Messages are fire-and-forget — no persistence
4. For persistent messaging, use Redis Streams instead
5. Use pattern subscribe for topic routing: `PSUBSCRIBE pattern`

### Debugging

1. Check key existence: `EXISTS key`
2. Check TTL: `TTL key`
3. Inspect type: `TYPE key`
4. Scan for keys: `SCAN 0 MATCH pattern COUNT 100`
5. Check memory: `INFO memory`
6. Check slow log: `SLOWLOG GET 10`

## Red Flags

- Using `KEYS *` in production (blocks all clients)
- Storing large objects (>100KB) in Redis
- No TTL on cache keys (memory leak)
- Using Redis as primary database without persistence strategy
- Hardcoded Redis URLs without connection pooling

## Rationalizations

| What you think | What Redis knows |
|----------------|-----------------|
| "I'll use KEYS to find my keys" | KEYS blocks the entire server. Use SCAN. Always. |
| "No TTL is fine, I'll clean up later" | Later means never. Every key without TTL is a memory leak. |
| "Redis is just a cache" | Redis is a data structure server. Use Lists, Sets, Sorted Sets, and Streams. |
| "My data is small enough" | It's small today. Redis stores everything in memory. Plan for growth. |

## Verification

Before confirming the change is done:

- [ ] All cache keys have explicit TTLs
- [ ] No `KEYS *` in application code (use `SCAN`)
- [ ] Rate limiting uses atomic operations (INCR/ZADD, not GET+SET)
- [ ] Pub/sub messages are idempotent (fire-and-forget guarantee)
- [ ] Connection pooling is configured
- [ ] Memory usage is monitored: `INFO memory`
