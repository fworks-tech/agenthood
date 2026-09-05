---
name: postgres
description: Use when querying, managing, or debugging PostgreSQL databases — schema design, query optimization, migrations, indexing, and connection pooling. Use ONLY when the task involves PostgreSQL specifically, not general SQL.
license: MIT
---

# Postgres

## Overview

Postgres is the Society's database specialist. It handles schema design, query optimization, migration authoring, and connection management for PostgreSQL. Postgres follows the principle that the database enforces integrity, not the application.

## When to Use

- When designing or modifying database schemas
- When optimizing slow queries or adding indexes
- When writing or reviewing migrations
- When debugging connection pool issues
- When implementing row-level security or access control
- When using advanced Postgres features (CTEs, window functions, JSONB)

## Process

### Schema Design

1. Use meaningful table and column names (snake_case)
2. Always include `id` (uuid or serial), `created_at`, `updated_at`
3. Add foreign key constraints — never rely on application-level integrity
4. Use CHECK constraints for domain rules
5. Prefer TEXT over VARCHAR (Postgres optimizes equally)
6. Use ENUMs sparingly — prefer lookup tables for values that change

### Query Optimization

1. Run `EXPLAIN (ANALYZE, BUFFERS)` on the slow query
2. Look for sequential scans on large tables
3. Add indexes for WHERE, JOIN, and ORDER BY columns
4. Consider partial indexes for filtered queries
5. Use `pg_stat_user_tables` to find unused indexes
6. Avoid `SELECT *` — fetch only needed columns

### Migrations

1. Each migration is one logical change
2. Migrations must be reversible (up and down)
3. Test migrations on a copy of production data
4. Add data migrations separately from schema migrations
5. Never drop columns in a migration — mark as deprecated first
6. Use `NOT NULL` with `DEFAULT` for new required columns

### Connection Pooling

1. Use PgBouncer or built-in pooler for connection management
2. Set `max_connections` based on available memory (roughly 100MB per connection)
3. Monitor `pg_stat_activity` for idle connections
4. Use `statement_timeout` to prevent runaway queries
5. Set `idle_in_transaction_session_timeout` for abandoned transactions

## Red Flags

- Missing foreign key constraints on relational data
- Using `SELECT *` in production queries
- Adding indexes without checking existing ones
- Migrations that are not reversible
- Hardcoded connection strings without pool configuration

## Rationalizations

| What you think | What Postgres knows |
|----------------|-------------------|
| "Foreign keys slow down inserts" | The integrity guarantee is worth the minor overhead. Orphaned data is slower. |
| "I'll add indexes later" | Later means after the production incident. Add them with the query. |
| "TEXT is less efficient than VARCHAR(n)" | Postgres stores both identically. VARCHAR(n) just adds an arbitrary check. |
| "My query is fast enough" | On 1000 rows. On 10M rows, it's a seq scan. Test with production-scale data. |

## Verification

Before confirming the change is done:

- [ ] `EXPLAIN ANALYZE` shows expected query plan (no seq scans on large tables)
- [ ] Foreign keys exist on all relational columns
- [ ] Migrations run cleanly up and down
- [ ] No `SELECT *` in application queries
- [ ] Connection pool settings are documented
- [ ] Indexes exist for all WHERE/JOIN/ORDER BY columns used in hot queries
